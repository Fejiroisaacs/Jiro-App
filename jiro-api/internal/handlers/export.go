package handlers

// Full account data export — one JSON file holding everything the account owns.
//
// SECURITY — read this before adding anything to this file.
//
// Every value that reaches the export file is copied into an explicit export
// struct declared below, field by field. The domain models (models.User,
// models.Session, models.JournalEntry, …) are deliberately NEVER marshalled
// straight into the response. That is the whole point of the duplication: a
// field added to a model later — a password hash, a refresh-token hash, an
// invite token, an OAuth secret, an API key — cannot leak into somebody's
// export by accident, because it does not exist here until a human types it
// out. models.User.PasswordHash and models.RefreshToken.TokenHash appear in no
// struct in this file, and none of the service calls below return a credential
// of any kind.
//
// Other people's personal data is left out too: shared journal groups export
// this account's own entries and the members' usernames, never other members'
// email addresses or their entries.

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/Fejiroisaacs/Jiro-App/jiro-api/internal/analytics"
	"github.com/Fejiroisaacs/Jiro-App/jiro-api/internal/models"
	"github.com/Fejiroisaacs/Jiro-App/jiro-api/internal/services"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog/log"
)

// exportVersion is the schema version of the export file. Bump it whenever the
// shape below changes in a way an importer would need to know about.
const exportVersion = 1

// Page sizes for the service list methods that paginate. Journaly's ListEntries
// clamps anything above 50 back down to 20, so 50 is the largest useful page.
const (
	exportJournalPageSize = 50
	exportLedgerPageSize  = 500
	// Safety valve so a paging bug can never spin forever.
	exportMaxPages = 400
)

type ExportHandler struct {
	userService     *services.UserService
	jymService      *services.JymService
	recipeService   *services.RecipeService
	mealPlanService *services.MealPlanService
	journalService  *services.JournalService
	ledgerService   *services.LedgerService
	db              *pgxpool.Pool
}

func NewExportHandler(userService *services.UserService, jymService *services.JymService, recipeService *services.RecipeService, mealPlanService *services.MealPlanService, journalService *services.JournalService, ledgerService *services.LedgerService, db *pgxpool.Pool) *ExportHandler {
	return &ExportHandler{userService: userService, jymService: jymService, recipeService: recipeService, mealPlanService: mealPlanService, journalService: journalService, ledgerService: ledgerService, db: db}
}

// ─── Export shape ─────────────────────────────────────────────────────────────

type exportPayload struct {
	Version    int                `json:"version"`
	ExportedAt time.Time          `json:"exported_at"`
	Account    exportAccountData  `json:"account"`
	Jym        exportJymData      `json:"jym"`
	Culinara   exportCulinaraData `json:"culinara"`
	Journaly   exportJournalyData `json:"journaly"`
	Ledger     exportLedgerData   `json:"ledger"`
}

type exportAccountData struct {
	ID            uuid.UUID       `json:"id"`
	Email         string          `json:"email"`
	Username      *string         `json:"username"`
	DisplayName   *string         `json:"display_name"`
	Bio           *string         `json:"bio"`
	AvatarURL     *string         `json:"avatar_url"`
	EmailVerified bool            `json:"email_verified"`
	Settings      json.RawMessage `json:"settings"`
	CreatedAt     time.Time       `json:"created_at"`
	UpdatedAt     time.Time       `json:"updated_at"`
}

// ── Jym ──

type exportJymData struct {
	Exercises   []exportExercise   `json:"exercises"`
	Splits      []exportSplit      `json:"splits"`
	Routines    []exportRoutine    `json:"routines"`
	Series      []exportSeries     `json:"series"`
	Sessions    []exportSession    `json:"sessions"`
	BodyWeights []exportBodyWeight `json:"body_weights"`
}

type exportExercise struct {
	ID          uuid.UUID `json:"id"`
	Name        string    `json:"name"`
	MuscleGroup *string   `json:"muscle_group"`
	Notes       *string   `json:"notes"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type exportSplit struct {
	ID          uuid.UUID `json:"id"`
	Name        string    `json:"name"`
	Description *string   `json:"description"`
	Visibility  string    `json:"visibility"`
	Tags        []string  `json:"tags"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// exportRoutine covers both split days and standalone templates; SplitID is
// null for a template.
type exportRoutine struct {
	ID        uuid.UUID           `json:"id"`
	SplitID   *uuid.UUID          `json:"split_id"`
	Name      string              `json:"name"`
	DayOrder  int                 `json:"day_order"`
	CreatedAt time.Time           `json:"created_at"`
	Items     []exportRoutineItem `json:"items"`
}

type exportRoutineItem struct {
	ID           uuid.UUID `json:"id"`
	ExerciseID   uuid.UUID `json:"exercise_id"`
	ExerciseName string    `json:"exercise_name"`
	MuscleGroup  *string   `json:"muscle_group"`
	TargetSets   int       `json:"target_sets"`
	TargetReps   int       `json:"target_reps"`
	OrderIndex   int       `json:"order_index"`
}

type exportSeries struct {
	ID             uuid.UUID  `json:"id"`
	SplitID        uuid.UUID  `json:"split_id"`
	SplitName      string     `json:"split_name"`
	Name           string     `json:"name"`
	DurationType   string     `json:"duration_type"`
	TargetWeeks    *int       `json:"target_weeks"`
	TargetSessions *int       `json:"target_sessions"`
	SessionCount   int        `json:"session_count"`
	StartedAt      time.Time  `json:"started_at"`
	EndedAt        *time.Time `json:"ended_at"`
	CreatedAt      time.Time  `json:"created_at"`
}

type exportSession struct {
	ID          uuid.UUID                 `json:"id"`
	RoutineID   *uuid.UUID                `json:"routine_id"`
	RoutineName *string                   `json:"routine_name"`
	SeriesID    *uuid.UUID                `json:"series_id"`
	SessionType string                    `json:"session_type"`
	StartedAt   time.Time                 `json:"started_at"`
	EndedAt     *time.Time                `json:"ended_at"`
	Notes       *string                   `json:"notes"`
	Sets        []exportSet               `json:"sets"`
	Attachments []exportSessionAttachment `json:"attachments"`
}

// Weights are stored and exported in kilograms, whatever the display unit is.
type exportSet struct {
	ID            uuid.UUID `json:"id"`
	ExerciseID    uuid.UUID `json:"exercise_id"`
	ExerciseName  string    `json:"exercise_name"`
	SetNumber     int       `json:"set_number"`
	WeightKg      float64   `json:"weight_kg"`
	RepsPerformed int       `json:"reps_performed"`
	RPE           *int      `json:"rpe"`
	IsPR          bool      `json:"is_pr"`
	IsWarmup      bool      `json:"is_warmup"`
	ExerciseNote  *string   `json:"exercise_note"`
	CreatedAt     time.Time `json:"created_at"`
}

type exportSessionAttachment struct {
	ID         uuid.UUID  `json:"id"`
	ExerciseID *uuid.UUID `json:"exercise_id"`
	FileURL    string     `json:"file_url"`
	FileType   string     `json:"file_type"`
	Label      *string    `json:"label"`
	CreatedAt  time.Time  `json:"created_at"`
}

type exportBodyWeight struct {
	ID         uuid.UUID `json:"id"`
	RecordedAt time.Time `json:"recorded_at"`
	WeightKg   float64   `json:"weight_kg"`
	CreatedAt  time.Time `json:"created_at"`
}

// ── Culinara ──

type exportCulinaraData struct {
	Recipes     []exportRecipe           `json:"recipes"`
	Collections []exportRecipeCollection `json:"collections"`
	// Every week the account has planned, not just the current one: an export
	// is meant to be the whole record.
	MealPlans []exportMealPlan `json:"meal_plans"`
	// ShoppingList lives in the browser (localStorage), not on the server, so
	// there is nothing to read here. The key stays so the shape never changes.
	ShoppingList []exportShoppingItem `json:"shopping_list"`
}

type exportRecipe struct {
	ID              uuid.UUID           `json:"id"`
	Title           string              `json:"title"`
	Description     *string             `json:"description"`
	Instructions    *string             `json:"instructions"`
	Tags            []string            `json:"tags"`
	BaseIngredients json.RawMessage     `json:"base_ingredients"`
	Nutrition       json.RawMessage     `json:"nutrition"`
	DietaryFlags    json.RawMessage     `json:"dietary_flags"`
	TargetImageURL  *string             `json:"target_image_url"`
	CoverImageURL   *string             `json:"cover_image_url"`
	IsPublic        bool                `json:"is_public"`
	CreatedAt       time.Time           `json:"created_at"`
	UpdatedAt       time.Time           `json:"updated_at"`
	Trials          []exportRecipeTrial `json:"trials"`
}

type exportRecipeTrial struct {
	ID             uuid.UUID       `json:"id"`
	DateCooked     time.Time       `json:"date_cooked"`
	Notes          *string         `json:"notes"`
	Modifications  json.RawMessage `json:"modifications"`
	Rating         *int            `json:"rating"`
	ResultImageURL *string         `json:"result_image_url"`
	CreatedAt      time.Time       `json:"created_at"`
}

type exportRecipeCollection struct {
	ID        uuid.UUID   `json:"id"`
	Name      string      `json:"name"`
	RecipeIDs []uuid.UUID `json:"recipe_ids"`
	CreatedAt time.Time   `json:"created_at"`
	UpdatedAt time.Time   `json:"updated_at"`
}

type exportMealPlan struct {
	ID        uuid.UUID             `json:"id"`
	WeekStart time.Time             `json:"week_start"`
	Entries   []exportMealPlanEntry `json:"entries"`
	CreatedAt time.Time             `json:"created_at"`
	UpdatedAt time.Time             `json:"updated_at"`
}

type exportMealPlanEntry struct {
	ID          uuid.UUID  `json:"id"`
	RecipeID    *uuid.UUID `json:"recipe_id"`
	RecipeTitle *string    `json:"recipe_title"`
	DayOfWeek   int        `json:"day_of_week"`
	MealSlot    string     `json:"meal_slot"`
	CustomLabel *string    `json:"custom_label"`
	Position    int        `json:"position"`
	CreatedAt   time.Time  `json:"created_at"`
}

type exportShoppingItem struct {
	Name string `json:"name"`
}

// ── Journaly ──

type exportJournalyData struct {
	Entries     []exportJournalEntry      `json:"entries"`
	Collections []exportJournalCollection `json:"collections"`
	Groups      []exportJournalGroup      `json:"groups"`
}

type exportJournalEntry struct {
	ID        uuid.UUID            `json:"id"`
	GroupID   *uuid.UUID           `json:"group_id"`
	Title     *string              `json:"title"`
	Body      string               `json:"body"`
	Mood      *string              `json:"mood"`
	Tags      []string             `json:"tags"`
	Images    []exportJournalImage `json:"images"`
	CreatedAt time.Time            `json:"created_at"`
	UpdatedAt time.Time            `json:"updated_at"`
}

type exportJournalImage struct {
	ID        uuid.UUID `json:"id"`
	FileURL   string    `json:"file_url"`
	CreatedAt time.Time `json:"created_at"`
}

type exportJournalCollection struct {
	ID            uuid.UUID   `json:"id"`
	Name          string      `json:"name"`
	Description   *string     `json:"description"`
	CoverImageURL *string     `json:"cover_image_url"`
	EntryIDs      []uuid.UUID `json:"entry_ids"`
	CreatedAt     time.Time   `json:"created_at"`
	UpdatedAt     time.Time   `json:"updated_at"`
}

type exportJournalGroup struct {
	ID        uuid.UUID                  `json:"id"`
	Name      string                     `json:"name"`
	OwnerID   uuid.UUID                  `json:"owner_id"`
	IsOwner   bool                       `json:"is_owner"`
	Members   []exportJournalGroupMember `json:"members"`
	Entries   []exportJournalEntry       `json:"entries"`
	CreatedAt time.Time                  `json:"created_at"`
	UpdatedAt time.Time                  `json:"updated_at"`
}

// No email address here on purpose — a member's email belongs to them, not to
// the account doing the exporting.
type exportJournalGroupMember struct {
	UserID   uuid.UUID  `json:"user_id"`
	Username *string    `json:"username"`
	Status   string     `json:"status"`
	JoinedAt *time.Time `json:"joined_at"`
}

// ── Ledger ──

type exportLedgerData struct {
	Accounts          []exportLedgerAccount     `json:"accounts"`
	Categories        []exportLedgerCategory    `json:"categories"`
	Transactions      []exportLedgerTransaction `json:"transactions"`
	Budgets           []exportLedgerBudget      `json:"budgets"`
	NetWorthSnapshots []exportNetWorthSnapshot  `json:"net_worth_snapshots"`
}

type exportLedgerAccount struct {
	ID        uuid.UUID `json:"id"`
	Name      string    `json:"name"`
	Type      string    `json:"type"`
	Currency  string    `json:"currency"`
	Balance   float64   `json:"balance"`
	IsActive  bool      `json:"is_active"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type exportLedgerCategory struct {
	ID        uuid.UUID  `json:"id"`
	Name      string     `json:"name"`
	Type      string     `json:"type"`
	Color     *string    `json:"color"`
	ParentID  *uuid.UUID `json:"parent_id"`
	CreatedAt time.Time  `json:"created_at"`
}

type exportLedgerTransaction struct {
	ID                  uuid.UUID  `json:"id"`
	AccountID           uuid.UUID  `json:"account_id"`
	CategoryID          *uuid.UUID `json:"category_id"`
	CategoryName        *string    `json:"category_name"`
	Type                string     `json:"type"`
	Amount              float64    `json:"amount"`
	Description         string     `json:"description"`
	Notes               *string    `json:"notes"`
	Date                time.Time  `json:"date"`
	IsRecurring         bool       `json:"is_recurring"`
	RecurrenceInterval  *string    `json:"recurrence_interval"`
	RecurrenceDay       *int       `json:"recurrence_day"`
	TransferToAccountID *uuid.UUID `json:"transfer_to_account_id"`
	CreatedAt           time.Time  `json:"created_at"`
	UpdatedAt           time.Time  `json:"updated_at"`
}

type exportLedgerBudget struct {
	ID           uuid.UUID `json:"id"`
	CategoryID   uuid.UUID `json:"category_id"`
	CategoryName string    `json:"category_name"`
	Amount       float64   `json:"amount"`
	Period       string    `json:"period"`
	StartDate    time.Time `json:"start_date"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type exportNetWorthSnapshot struct {
	ID               uuid.UUID `json:"id"`
	AssetsTotal      float64   `json:"assets_total"`
	LiabilitiesTotal float64   `json:"liabilities_total"`
	NetWorth         float64   `json:"net_worth"`
	SnapshotDate     time.Time `json:"snapshot_date"`
}

// ─── Handler ──────────────────────────────────────────────────────────────────

// ExportAccount handles GET /export/account.json.
//
// Everything is gathered before a single byte is written, so a module that
// fails takes the whole request down with a 500 rather than handing the user a
// half-empty file that looks complete.
func (h *ExportHandler) ExportAccount(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	ctx := c.Request.Context()

	payload := exportPayload{
		Version:    exportVersion,
		ExportedAt: time.Now().UTC(),
	}

	account, err := h.gatherAccount(ctx, userID)
	if err != nil {
		exportFailed(c, "account", err)
		return
	}
	payload.Account = account

	jym, err := h.gatherJym(ctx, userID)
	if err != nil {
		exportFailed(c, "jym", err)
		return
	}
	payload.Jym = jym

	culinara, err := h.gatherCulinara(ctx, userID)
	if err != nil {
		exportFailed(c, "culinara", err)
		return
	}
	payload.Culinara = culinara

	journaly, err := h.gatherJournaly(ctx, userID)
	if err != nil {
		exportFailed(c, "journaly", err)
		return
	}
	payload.Journaly = journaly

	ledger, err := h.gatherLedger(ctx, userID)
	if err != nil {
		exportFailed(c, "ledger", err)
		return
	}
	payload.Ledger = ledger

	filename := "jiro-export-" + time.Now().Format("2006-01-02") + ".json"
	c.Header("Content-Type", "application/json; charset=utf-8")
	c.Header("Content-Disposition", `attachment; filename="`+filename+`"`)
	c.JSON(http.StatusOK, payload)

	analytics.TrackEvent(h.db, userID, "export.account", nil)
}

// exportFailed logs which module broke and refuses the whole export.
func exportFailed(c *gin.Context, module string, err error) {
	log.Error().Err(err).Str("module", module).Msg("account export failed")
	c.JSON(http.StatusInternalServerError, models.ErrorResponse{
		Error: models.ErrorDetail{Code: "EXPORT_FAILED", Message: "Failed to export " + module + " data"},
	})
}

// ─── Gatherers ────────────────────────────────────────────────────────────────

func (h *ExportHandler) gatherAccount(ctx context.Context, userID uuid.UUID) (exportAccountData, error) {
	user, err := h.userService.GetByID(ctx, userID)
	if err != nil {
		return exportAccountData{}, err
	}
	// Copied field by field — the password hash is not listed, so it cannot
	// travel. See the security note at the top of the file.
	return exportAccountData{
		ID:            user.ID,
		Email:         user.Email,
		Username:      user.Username,
		DisplayName:   user.DisplayName,
		Bio:           user.Bio,
		AvatarURL:     user.AvatarUrl,
		EmailVerified: user.EmailVerified,
		Settings:      exportRawOrDefault(user.Settings, "{}"),
		CreatedAt:     user.CreatedAt,
		UpdatedAt:     user.UpdatedAt,
	}, nil
}

func (h *ExportHandler) gatherJym(ctx context.Context, userID uuid.UUID) (exportJymData, error) {
	out := exportJymData{
		Exercises:   []exportExercise{},
		Splits:      []exportSplit{},
		Routines:    []exportRoutine{},
		Series:      []exportSeries{},
		Sessions:    []exportSession{},
		BodyWeights: []exportBodyWeight{},
	}

	exercises, err := h.jymService.ListExercises(ctx, userID, "", "")
	if err != nil {
		return out, err
	}
	for _, ex := range exercises {
		out.Exercises = append(out.Exercises, exportExercise{
			ID:          ex.ID,
			Name:        ex.Name,
			MuscleGroup: ex.MuscleGroup,
			Notes:       ex.Notes,
			CreatedAt:   ex.CreatedAt,
			UpdatedAt:   ex.UpdatedAt,
		})
	}

	splits, err := h.jymService.ListSplits(ctx, userID)
	if err != nil {
		return out, err
	}
	for _, sp := range splits {
		out.Splits = append(out.Splits, exportSplit{
			ID:          sp.ID,
			Name:        sp.Name,
			Description: sp.Description,
			Visibility:  sp.Visibility,
			Tags:        exportStrings(sp.Tags),
			CreatedAt:   sp.CreatedAt,
			UpdatedAt:   sp.UpdatedAt,
		})

		// Routines (and their exercise targets) hang off the split.
		detail, err := h.jymService.GetSplitWithRoutines(ctx, userID, sp.ID)
		if err != nil {
			return out, err
		}
		for _, r := range detail.Routines {
			out.Routines = append(out.Routines, newExportRoutine(r))
		}
	}

	// Standalone routines (templates) have no split, so they are not covered above.
	templates, err := h.jymService.ListTemplates(ctx, userID)
	if err != nil {
		return out, err
	}
	for _, r := range templates {
		out.Routines = append(out.Routines, newExportRoutine(r))
	}

	series, err := h.jymService.ListSeries(ctx, userID)
	if err != nil {
		return out, err
	}
	for _, s := range series {
		out.Series = append(out.Series, exportSeries{
			ID:             s.ID,
			SplitID:        s.SplitID,
			SplitName:      s.SplitName,
			Name:           s.Name,
			DurationType:   s.DurationType,
			TargetWeeks:    s.TargetWeeks,
			TargetSessions: s.TargetSessions,
			SessionCount:   s.SessionCount,
			StartedAt:      s.StartedAt,
			EndedAt:        s.EndedAt,
			CreatedAt:      s.CreatedAt,
		})
	}

	// ListAllSessions, not ListSessions: the latter caps at 50 for the list
	// screens, which would silently truncate an export of a long history.
	sessions, err := h.jymService.ListAllSessions(ctx, userID)
	if err != nil {
		return out, err
	}
	for _, summary := range sessions {
		// The session list has no sets on it; GetSession is what carries them.
		full, err := h.jymService.GetSession(ctx, userID, summary.ID)
		if err != nil {
			return out, err
		}
		s := exportSession{
			ID:          full.ID,
			RoutineID:   full.RoutineID,
			RoutineName: full.RoutineName,
			SeriesID:    full.SeriesID,
			SessionType: full.SessionType,
			StartedAt:   full.StartedAt,
			EndedAt:     full.EndedAt,
			Notes:       full.Notes,
			Sets:        []exportSet{},
			Attachments: []exportSessionAttachment{},
		}
		for _, set := range full.Sets {
			s.Sets = append(s.Sets, exportSet{
				ID:            set.ID,
				ExerciseID:    set.ExerciseID,
				ExerciseName:  set.ExerciseName,
				SetNumber:     set.SetNumber,
				WeightKg:      set.Weight,
				RepsPerformed: set.RepsPerformed,
				RPE:           set.RPE,
				IsPR:          set.IsPR,
				IsWarmup:      set.IsWarmup,
				ExerciseNote:  set.ExerciseNote,
				CreatedAt:     set.CreatedAt,
			})
		}
		for _, a := range full.Attachments {
			s.Attachments = append(s.Attachments, exportSessionAttachment{
				ID:         a.ID,
				ExerciseID: a.ExerciseID,
				FileURL:    a.FileURL,
				FileType:   a.FileType,
				Label:      a.Label,
				CreatedAt:  a.CreatedAt,
			})
		}
		out.Sessions = append(out.Sessions, s)
	}

	weights, err := h.jymService.ListAllBodyWeights(ctx, userID)
	if err != nil {
		return out, err
	}
	for _, w := range weights {
		out.BodyWeights = append(out.BodyWeights, exportBodyWeight{
			ID:         w.ID,
			RecordedAt: w.RecordedAt,
			WeightKg:   w.WeightKg,
			CreatedAt:  w.CreatedAt,
		})
	}

	return out, nil
}

func newExportRoutine(r models.RoutineWithItems) exportRoutine {
	out := exportRoutine{
		ID:        r.ID,
		SplitID:   r.SplitID,
		Name:      r.Name,
		DayOrder:  r.DayOrder,
		CreatedAt: r.CreatedAt,
		Items:     []exportRoutineItem{},
	}
	for _, it := range r.Items {
		out.Items = append(out.Items, exportRoutineItem{
			ID:           it.ID,
			ExerciseID:   it.ExerciseID,
			ExerciseName: it.ExerciseName,
			MuscleGroup:  it.MuscleGroup,
			TargetSets:   it.TargetSets,
			TargetReps:   it.TargetReps,
			OrderIndex:   it.OrderIndex,
		})
	}
	return out
}

func (h *ExportHandler) gatherCulinara(ctx context.Context, userID uuid.UUID) (exportCulinaraData, error) {
	out := exportCulinaraData{
		Recipes:      []exportRecipe{},
		Collections:  []exportRecipeCollection{},
		MealPlans:    []exportMealPlan{},
		ShoppingList: []exportShoppingItem{},
	}

	recipes, err := h.recipeService.ListRecipes(ctx, userID, "", nil)
	if err != nil {
		return out, err
	}
	for _, r := range recipes {
		// ListRecipes has no trials on it; GetRecipe is what carries them.
		full, err := h.recipeService.GetRecipe(ctx, userID, r.ID)
		if err != nil {
			return out, err
		}
		rec := exportRecipe{
			ID:              full.ID,
			Title:           full.Title,
			Description:     full.Description,
			Instructions:    full.Instructions,
			Tags:            exportStrings(full.Tags),
			BaseIngredients: exportRawOrDefault(full.BaseIngredients, "[]"),
			Nutrition:       exportRawOrDefault(full.Nutrition, "{}"),
			DietaryFlags:    exportRawOrDefault(full.DietaryFlags, "{}"),
			TargetImageURL:  full.TargetImageURL,
			CoverImageURL:   full.CoverImageURL,
			IsPublic:        full.IsPublic,
			CreatedAt:       full.CreatedAt,
			UpdatedAt:       full.UpdatedAt,
			Trials:          []exportRecipeTrial{},
		}
		for _, t := range full.Trials {
			rec.Trials = append(rec.Trials, exportRecipeTrial{
				ID:             t.ID,
				DateCooked:     t.DateCooked,
				Notes:          t.Notes,
				Modifications:  exportRawOrDefault(t.Modifications, "[]"),
				Rating:         t.Rating,
				ResultImageURL: t.ResultImageURL,
				CreatedAt:      t.CreatedAt,
			})
		}
		out.Recipes = append(out.Recipes, rec)
	}

	collections, err := h.recipeService.ListCollections(ctx, userID)
	if err != nil {
		return out, err
	}
	for _, col := range collections {
		ids, err := h.recipeService.GetCollectionRecipeIDs(ctx, userID, col.ID)
		if err != nil {
			return out, err
		}
		if ids == nil {
			ids = []uuid.UUID{}
		}
		out.Collections = append(out.Collections, exportRecipeCollection{
			ID:        col.ID,
			Name:      col.Name,
			RecipeIDs: ids,
			CreatedAt: col.CreatedAt,
			UpdatedAt: col.UpdatedAt,
		})
	}

	// ListPlans, not GetOrCreatePlan: the latter upserts the week it returns,
	// which would make this read-only export write a row for a week the user
	// never planned.
	plans, err := h.mealPlanService.ListPlans(ctx, userID)
	if err != nil {
		return out, err
	}
	for _, plan := range plans {
		ep := exportMealPlan{
			ID:        plan.ID,
			WeekStart: plan.WeekStart,
			Entries:   []exportMealPlanEntry{},
			CreatedAt: plan.CreatedAt,
			UpdatedAt: plan.UpdatedAt,
		}
		for _, e := range plan.Entries {
			ep.Entries = append(ep.Entries, exportMealPlanEntry{
				ID:          e.ID,
				RecipeID:    e.RecipeID,
				RecipeTitle: e.RecipeTitle,
				DayOfWeek:   e.DayOfWeek,
				MealSlot:    e.MealSlot,
				CustomLabel: e.CustomLabel,
				Position:    e.Position,
				CreatedAt:   e.CreatedAt,
			})
		}
		out.MealPlans = append(out.MealPlans, ep)
	}

	return out, nil
}

func (h *ExportHandler) gatherJournaly(ctx context.Context, userID uuid.UUID) (exportJournalyData, error) {
	out := exportJournalyData{
		Entries:     []exportJournalEntry{},
		Collections: []exportJournalCollection{},
		Groups:      []exportJournalGroup{},
	}

	// ListEntries is paginated and caps a page at 50, so walk it to the end.
	for page := 0; page < exportMaxPages; page++ {
		batch, _, err := h.journalService.ListEntries(ctx, userID, "", "", "", "", "", exportJournalPageSize, page*exportJournalPageSize)
		if err != nil {
			return out, err
		}
		for _, e := range batch {
			// ListEntries leaves images empty; GetEntry is what carries them.
			full, err := h.journalService.GetEntry(ctx, userID, e.ID)
			if err != nil {
				return out, err
			}
			out.Entries = append(out.Entries, newExportJournalEntry(full))
		}
		if len(batch) < exportJournalPageSize {
			break
		}
	}

	collections, err := h.journalService.ListCollections(ctx, userID)
	if err != nil {
		return out, err
	}
	for _, col := range collections {
		_, entries, err := h.journalService.GetCollection(ctx, userID, col.ID)
		if err != nil {
			return out, err
		}
		ids := make([]uuid.UUID, 0, len(entries))
		for _, e := range entries {
			ids = append(ids, e.ID)
		}
		out.Collections = append(out.Collections, exportJournalCollection{
			ID:            col.ID,
			Name:          col.Name,
			Description:   col.Description,
			CoverImageURL: col.CoverImageURL,
			EntryIDs:      ids,
			CreatedAt:     col.CreatedAt,
			UpdatedAt:     col.UpdatedAt,
		})
	}

	groups, err := h.journalService.ListGroups(ctx, userID)
	if err != nil {
		return out, err
	}
	for _, g := range groups {
		detail, err := h.journalService.GetGroup(ctx, userID, g.ID)
		if err != nil {
			return out, err
		}
		grp := exportJournalGroup{
			ID:        detail.ID,
			Name:      detail.Name,
			OwnerID:   detail.OwnerID,
			IsOwner:   detail.OwnerID == userID,
			Members:   []exportJournalGroupMember{},
			Entries:   []exportJournalEntry{},
			CreatedAt: detail.CreatedAt,
			UpdatedAt: detail.UpdatedAt,
		}
		for _, m := range detail.Members {
			grp.Members = append(grp.Members, exportJournalGroupMember{
				UserID:   m.UserID,
				Username: m.UserUsername,
				Status:   m.Status,
				JoinedAt: m.JoinedAt,
			})
		}

		groupEntries, err := h.journalService.ListGroupEntries(ctx, userID, g.ID)
		if err != nil {
			return out, err
		}
		for _, e := range groupEntries {
			// A shared group holds other members' entries too. They are theirs,
			// not this account's, so only this account's own entries are exported.
			if e.UserID != userID {
				continue
			}
			full, err := h.journalService.GetEntry(ctx, userID, e.ID)
			if err != nil {
				return out, err
			}
			grp.Entries = append(grp.Entries, newExportJournalEntry(full))
		}

		out.Groups = append(out.Groups, grp)
	}

	return out, nil
}

func newExportJournalEntry(e *models.JournalEntry) exportJournalEntry {
	out := exportJournalEntry{
		ID:        e.ID,
		GroupID:   e.GroupID,
		Title:     e.Title,
		Body:      e.Body,
		Mood:      e.Mood,
		Tags:      exportStrings(e.Tags),
		Images:    []exportJournalImage{},
		CreatedAt: e.CreatedAt,
		UpdatedAt: e.UpdatedAt,
	}
	for _, img := range e.Images {
		out.Images = append(out.Images, exportJournalImage{
			ID:        img.ID,
			FileURL:   img.FileURL,
			CreatedAt: img.CreatedAt,
		})
	}
	return out
}

func (h *ExportHandler) gatherLedger(ctx context.Context, userID uuid.UUID) (exportLedgerData, error) {
	out := exportLedgerData{
		Accounts:          []exportLedgerAccount{},
		Categories:        []exportLedgerCategory{},
		Transactions:      []exportLedgerTransaction{},
		Budgets:           []exportLedgerBudget{},
		NetWorthSnapshots: []exportNetWorthSnapshot{},
	}

	accounts, err := h.ledgerService.ListAccounts(ctx, userID)
	if err != nil {
		return out, err
	}
	for _, a := range accounts {
		out.Accounts = append(out.Accounts, exportLedgerAccount{
			ID:        a.ID,
			Name:      a.Name,
			Type:      a.Type,
			Currency:  a.Currency,
			Balance:   a.Balance,
			IsActive:  a.IsActive,
			CreatedAt: a.CreatedAt,
			UpdatedAt: a.UpdatedAt,
		})
	}

	// ListCategories returns a parent/child tree; the export is flat and keeps
	// parent_id, which is the same information without the nesting.
	tree, err := h.ledgerService.ListCategories(ctx, userID)
	if err != nil {
		return out, err
	}
	for _, parent := range tree {
		out.Categories = append(out.Categories, newExportLedgerCategory(parent.LedgerCategory))
		for _, child := range parent.Children {
			out.Categories = append(out.Categories, newExportLedgerCategory(child))
		}
	}

	// ListTransactions is paginated (1-based page), so walk it to the end.
	for page := 1; page <= exportMaxPages; page++ {
		batch, err := h.ledgerService.ListTransactions(ctx, userID, models.TransactionFilters{
			Page:  page,
			Limit: exportLedgerPageSize,
		})
		if err != nil {
			return out, err
		}
		for _, t := range batch {
			out.Transactions = append(out.Transactions, exportLedgerTransaction{
				ID:                  t.ID,
				AccountID:           t.AccountID,
				CategoryID:          t.CategoryID,
				CategoryName:        t.CategoryName,
				Type:                t.Type,
				Amount:              t.Amount,
				Description:         t.Description,
				Notes:               t.Notes,
				Date:                t.Date,
				IsRecurring:         t.IsRecurring,
				RecurrenceInterval:  t.RecurrenceInterval,
				RecurrenceDay:       t.RecurrenceDay,
				TransferToAccountID: t.TransferToAccountID,
				CreatedAt:           t.CreatedAt,
				UpdatedAt:           t.UpdatedAt,
			})
		}
		if len(batch) < exportLedgerPageSize {
			break
		}
	}

	budgets, err := h.ledgerService.ListBudgets(ctx, userID, "")
	if err != nil {
		return out, err
	}
	for _, b := range budgets {
		out.Budgets = append(out.Budgets, exportLedgerBudget{
			ID:           b.ID,
			CategoryID:   b.CategoryID,
			CategoryName: b.CategoryName,
			Amount:       b.Amount,
			Period:       b.Period,
			StartDate:    b.StartDate,
			CreatedAt:    b.CreatedAt,
			UpdatedAt:    b.UpdatedAt,
		})
	}

	snapshots, err := h.ledgerService.ListSnapshots(ctx, userID)
	if err != nil {
		return out, err
	}
	for _, s := range snapshots {
		out.NetWorthSnapshots = append(out.NetWorthSnapshots, exportNetWorthSnapshot{
			ID:               s.ID,
			AssetsTotal:      s.AssetsTotal,
			LiabilitiesTotal: s.LiabilitiesTotal,
			NetWorth:         s.NetWorth,
			SnapshotDate:     s.SnapshotDate,
		})
	}

	return out, nil
}

func newExportLedgerCategory(c models.LedgerCategory) exportLedgerCategory {
	return exportLedgerCategory{
		ID:        c.ID,
		Name:      c.Name,
		Type:      c.Type,
		Color:     c.Color,
		ParentID:  c.ParentID,
		CreatedAt: c.CreatedAt,
	}
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// exportStrings makes sure a string slice marshals as [] and never as null, so
// the file always parses to the same shape.
func exportStrings(in []string) []string {
	if in == nil {
		return []string{}
	}
	return in
}

// exportRawOrDefault substitutes an empty JSON document for a missing one, for
// the same reason.
func exportRawOrDefault(raw json.RawMessage, fallback string) json.RawMessage {
	if len(raw) == 0 || string(raw) == "null" {
		return json.RawMessage(fallback)
	}
	return raw
}
