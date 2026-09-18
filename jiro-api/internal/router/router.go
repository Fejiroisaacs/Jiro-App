package router

import (
	"github.com/Fejiroisaacs/Jiro-App/jiro-api/internal/config"
	"github.com/Fejiroisaacs/Jiro-App/jiro-api/internal/handlers"
	"github.com/Fejiroisaacs/Jiro-App/jiro-api/internal/middleware"
	"github.com/Fejiroisaacs/Jiro-App/jiro-api/internal/services"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

func Setup(db *pgxpool.Pool, cfg *config.Config) *gin.Engine {
	if cfg.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.New()
	// Trust only private/loopback ranges — prevents X-Forwarded-For IP spoofing
	r.SetTrustedProxies([]string{"127.0.0.1", "::1", "10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16"})
	r.Use(gin.Recovery())
	r.Use(middleware.CORS(cfg.CORSOrigins))
	r.Use(middleware.SecurityHeaders(cfg.Environment))
	r.Use(middleware.MaxBodySize(1 << 20)) // 1 MB cap on all request bodies

	// Services
	authService := services.NewAuthService(db, cfg)
	userService := services.NewUserService(db)
	recipeService := services.NewRecipeService(db)
	jymService := services.NewJymService(db)
	journalService := services.NewJournalService(db)
	feedbackService := services.NewFeedbackService(db)
	emailService := services.NewEmailService(cfg.ResendAPIKey, cfg.EmailFrom)
	adminService := services.NewAdminService(db)
	mealPlanService := services.NewMealPlanService(db)
	storageService := services.NewStorageService(cfg.StorageEndpoint, cfg.StorageBucket, cfg.StorageAccessKey, cfg.StorageSecretKey, cfg.StoragePublicURL)
	ledgerService := services.NewLedgerService(db)

	// Rate limiter + login fail tracker
	rl := middleware.NewRateLimiter()
	loginFailTracker := middleware.NewLoginFailTracker()

	// Handlers
	authHandler := handlers.NewAuthHandler(authService, userService, emailService, ledgerService, loginFailTracker, cfg, db)
	ledgerHandler := handlers.NewLedgerHandler(ledgerService)
	userHandler := handlers.NewUserHandler(userService)
	healthHandler := handlers.NewHealthHandler(db)
	recipeHandler := handlers.NewRecipeHandler(recipeService, db, cfg.AppBaseURL)
	jymHandler := handlers.NewJymHandler(jymService, storageService, cfg.AppBaseURL, db)
	adminHandler := handlers.NewAdminHandler(adminService, authService, userService, emailService, cfg.AppBaseURL)
	feedbackHandler := handlers.NewFeedbackHandler(feedbackService)
	mealPlanHandler := handlers.NewMealPlanHandler(mealPlanService)
	uploadHandler := handlers.NewUploadHandler(storageService, userService, recipeService, jymService, journalService)
	journalHandler := handlers.NewJournalHandler(journalService, emailService, storageService, cfg.AppBaseURL)
	exportHandler := handlers.NewExportHandler(userService, jymService, recipeService, mealPlanService, journalService, ledgerService, db)

	// Routes
	v1 := r.Group("/api/v1")
	{
		// Health (no auth, no rate limit)
		v1.GET("/health", healthHandler.Check)

		// Public routes (rate limited by IP: 60/min)
		public := v1.Group("")
		public.Use(middleware.RateLimitByIP(rl, "public", 60))
		// Opted-in public content, plus share links reached by token. The
		// token ones are unlisted rather than public, so a shared cache
		// holding a copy would be a leak. There is no SEO cost to no-store
		// here: crawlers read the prerendered HTML from the frontend host,
		// not this JSON, so the only thing a cache would save is a little
		// origin traffic on an app this size.
		public.Use(middleware.NoStore())
		{
			public.GET("/profiles/:username", userHandler.GetPublicProfile)
			public.GET("/jym/shares/:share_id", jymHandler.GetSharePreview)
			public.GET("/culinara/shares/:token", recipeHandler.GetSharedRecipe)
			public.GET("/culinara/discover", recipeHandler.ListPublicRecipes)
			public.GET("/culinara/discover/:id", recipeHandler.GetPublicRecipe)
			public.GET("/jym/public-splits", jymHandler.ListPublicSplits)
			public.GET("/jym/public-splits/:id", jymHandler.GetPublicSplit)
		}

		// Auth routes (rate limited by IP: 5/min)
		auth := v1.Group("/auth")
		auth.Use(middleware.RateLimitByIP(rl, "auth", 5))
		// These responses carry access tokens and single-use reset material.
		auth.Use(middleware.NoStore())
		{
			auth.POST("/register", authHandler.Register)
			auth.POST("/login", authHandler.Login)
			// Cookie-authenticated, so the only CSRF-reachable routes.
			auth.POST("/refresh", middleware.RequireTrustedOrigin(cfg.CORSOrigins), authHandler.Refresh)
			auth.POST("/logout", middleware.RequireTrustedOrigin(cfg.CORSOrigins), authHandler.Logout)
			auth.POST("/verify-email", authHandler.VerifyEmail)
			auth.POST("/forgot-password", authHandler.ForgotPassword)
			auth.POST("/reset-password", authHandler.ResetPassword)
		}

		// Protected routes (require JWT, rate limited by user: 300/min)
		protected := v1.Group("")
		protected.Use(middleware.AuthRequired(authService))
		protected.Use(middleware.RateLimitByUser(rl, "protected", 300))
		// Everything behind here is one person's own data.
		protected.Use(middleware.NoStore())
		{
			protected.GET("/user/me", userHandler.GetMe)
			protected.PATCH("/user/me", userHandler.UpdateMe)
			protected.POST("/auth/resend-verification", authHandler.ResendVerification)

			// Upload — avatar (presign tighter: 20/min per user)
			protected.POST("/upload/avatar/presign", middleware.RateLimitByUser(rl, "presign", 20), uploadHandler.PresignAvatar)
			protected.PATCH("/upload/avatar/confirm", uploadHandler.ConfirmAvatar)
			protected.DELETE("/upload/avatar", uploadHandler.DeleteAvatar)

			// Upload — recipe cover image (presign tighter: 20/min per user)
			protected.POST("/upload/recipe/:recipe_id/presign", middleware.RateLimitByUser(rl, "presign", 20), uploadHandler.PresignRecipeImage)
			protected.PATCH("/upload/recipe/:recipe_id/confirm", uploadHandler.ConfirmRecipeImage)
			protected.DELETE("/upload/recipe/:recipe_id/image", uploadHandler.DeleteRecipeImage)

			// Upload — session attachments (presign tighter: 20/min per user)
			protected.POST("/upload/session/:session_id/presign", middleware.RateLimitByUser(rl, "presign", 20), uploadHandler.PresignSessionAttachment)
			protected.PATCH("/upload/session/:session_id/confirm", uploadHandler.ConfirmSessionAttachment)
			protected.DELETE("/upload/session/attachments/:attachment_id", uploadHandler.DeleteSessionAttachment)

			// Upload — journal collection cover (presign tighter: 20/min per user)
			protected.POST("/upload/journal-collection/:collection_id/presign", middleware.RateLimitByUser(rl, "presign", 20), uploadHandler.PresignCollectionCover)
			protected.PATCH("/upload/journal-collection/:collection_id/confirm", uploadHandler.ConfirmCollectionCover)
			protected.DELETE("/upload/journal-collection/:collection_id/cover", uploadHandler.DeleteCollectionCover)

			// Feedback
			protected.POST("/feedback", feedbackHandler.Submit)

			// Account data export (expensive — tighter limit: 5/min per user)
			protected.GET("/export/account.json", middleware.RateLimitByUser(rl, "export", 5), exportHandler.ExportAccount)

			// Culinara (Recipe Module)
			culinara := protected.Group("/culinara")
			{
				culinara.GET("/cook-streak", recipeHandler.CookStreak)
				culinara.POST("/recipes", recipeHandler.Create)
				culinara.GET("/recipes", recipeHandler.List)
				culinara.GET("/recipes/:id", recipeHandler.Get)
				culinara.PUT("/recipes/:id", recipeHandler.Update)
				culinara.DELETE("/recipes/:id", recipeHandler.Delete)
				culinara.POST("/recipes/:id/trials", recipeHandler.CreateTrial)
				culinara.PUT("/trials/:id", recipeHandler.UpdateTrial)
				culinara.DELETE("/trials/:id", recipeHandler.DeleteTrial)
				culinara.POST("/promote/:trial_id", recipeHandler.Promote)

				// Sharing
				culinara.POST("/recipes/:id/share", recipeHandler.CreateShare)
				culinara.POST("/shares/:token/import", recipeHandler.ImportSharedRecipe)
				culinara.POST("/discover/:id/import", recipeHandler.ImportPublicRecipe)

				// Meal Planner
				culinara.GET("/meal-plan", mealPlanHandler.GetOrCreate)
				culinara.POST("/meal-plan/:plan_id/entries", mealPlanHandler.AddEntry)
				culinara.DELETE("/meal-plan/entries/:entry_id", mealPlanHandler.RemoveEntry)

				// Public toggle
				culinara.PATCH("/recipes/:id/public", recipeHandler.SetPublicStatus)

				// Collections
				culinara.GET("/collections", recipeHandler.ListCollections)
				culinara.POST("/collections", recipeHandler.CreateCollection)
				culinara.PUT("/collections/:id", recipeHandler.UpdateCollection)
				culinara.DELETE("/collections/:id", recipeHandler.DeleteCollection)
				culinara.POST("/collections/:id/recipes", recipeHandler.AddToCollection)
				culinara.DELETE("/collections/:id/recipes/:recipe_id", recipeHandler.RemoveFromCollection)
				culinara.GET("/collections/:id/recipe-ids", recipeHandler.GetCollectionRecipeIDs)
			}

			// Jym (Gym Module)
			jym := protected.Group("/jym")
			{
				// Exercises
				jym.POST("/exercises", jymHandler.CreateExercise)
				jym.GET("/exercises", jymHandler.ListExercises)
				jym.GET("/exercises/:id", jymHandler.GetExercise)
				jym.PUT("/exercises/:id", jymHandler.UpdateExercise)
				jym.DELETE("/exercises/:id", jymHandler.DeleteExercise)
				jym.GET("/exercises/:id/form-checks", jymHandler.GetExerciseFormChecks)
				jym.GET("/prs", jymHandler.GetPRs)

				// Splits
				jym.POST("/splits", jymHandler.CreateSplit)
				jym.GET("/splits", jymHandler.ListSplits)
				jym.GET("/splits/:id", jymHandler.GetSplit)
				jym.PUT("/splits/:id", jymHandler.UpdateSplit)
				jym.DELETE("/splits/:id", jymHandler.DeleteSplit)

				// Routines (nested under splits, or standalone for update/delete/items)
				jym.POST("/splits/:split_id/routines", jymHandler.CreateRoutine)
				jym.PUT("/routines/:id", jymHandler.UpdateRoutine)
				jym.DELETE("/routines/:id", jymHandler.DeleteRoutine)
				jym.PUT("/routines/:id/items", jymHandler.ReplaceRoutineItems)

				// Templates (standalone routines)
				jym.GET("/templates", jymHandler.ListTemplates)

				// Sessions
				jym.POST("/sessions", jymHandler.StartSession)
				jym.GET("/sessions", jymHandler.ListSessions)
				jym.GET("/sessions/:id", jymHandler.GetSession)
				jym.PATCH("/sessions/:id", jymHandler.UpdateSession)
				jym.DELETE("/sessions/:id", jymHandler.DeleteSession)
				jym.GET("/export/sessions.csv", jymHandler.ExportSessions)
				jym.POST("/sessions/:id/template", jymHandler.CreateTemplateFromSession)

				// Sets
				jym.POST("/sessions/:id/sets", jymHandler.LogSet)
				jym.PUT("/sets/:id", jymHandler.UpdateSet)
				jym.DELETE("/sets/:id", jymHandler.DeleteSet)

				// Body weights
				jym.POST("/bodyweights", jymHandler.LogBodyWeight)
				jym.GET("/bodyweights", jymHandler.ListBodyWeights)
				jym.DELETE("/bodyweights/:id", jymHandler.DeleteBodyWeight)

				// Series
				jym.POST("/series", jymHandler.CreateSeries)
				jym.GET("/series", jymHandler.ListSeries)
				jym.GET("/series/:id", jymHandler.GetSeries)
				jym.PATCH("/series/:id", jymHandler.UpdateSeries)
				jym.DELETE("/series/:id", jymHandler.DeleteSeries)

				// Split shares (auth required for create/revoke/import)
				jym.POST("/splits/:split_id/share", jymHandler.CreateShare)
				jym.DELETE("/shares/:share_id", jymHandler.RevokeShare)
				jym.POST("/shares/:share_id/import", jymHandler.ImportShare)

				// Public split import (auth required)
				jym.POST("/public-splits/:id/import", jymHandler.ImportPublicSplit)
			}

			// Ledger (Finance Module)
			ledger := protected.Group("/ledger")
			{
				// Accounts
				ledger.POST("/accounts", ledgerHandler.CreateAccount)
				ledger.GET("/accounts", ledgerHandler.ListAccounts)
				ledger.GET("/accounts/:id", ledgerHandler.GetAccount)
				ledger.PATCH("/accounts/:id", ledgerHandler.UpdateAccount)
				ledger.DELETE("/accounts/:id", ledgerHandler.DeleteAccount)

				// Transactions
				ledger.POST("/transactions", ledgerHandler.CreateTransaction)
				ledger.GET("/transactions", ledgerHandler.ListTransactions)
				ledger.GET("/transactions/:id", ledgerHandler.GetTransaction)
				ledger.PATCH("/transactions/:id", ledgerHandler.UpdateTransaction)
				ledger.DELETE("/transactions/:id", ledgerHandler.DeleteTransaction)

				// Categories
				ledger.POST("/categories", ledgerHandler.CreateCategory)
				ledger.GET("/categories", ledgerHandler.ListCategories)
				ledger.PATCH("/categories/:id", ledgerHandler.UpdateCategory)
				ledger.DELETE("/categories/:id", ledgerHandler.DeleteCategory)

				// Budgets
				ledger.POST("/budgets", ledgerHandler.CreateBudget)
				ledger.GET("/budgets", ledgerHandler.ListBudgets)
				ledger.DELETE("/budgets/:id", ledgerHandler.DeleteBudget)

				// Summary, Net Worth, Comparison
				ledger.GET("/summary", ledgerHandler.GetSummary)
				ledger.GET("/networth", ledgerHandler.GetNetWorth)
				ledger.POST("/networth/snapshot", ledgerHandler.CreateSnapshot)
				ledger.GET("/compare", ledgerHandler.GetComparison)
			}
		}

		// Journaly (Journal Module)
		journal := protected.Group("/journal")
		{
			// Private entries
			journal.POST("/entries", journalHandler.CreateEntry)
			journal.GET("/entries", journalHandler.ListEntries)
			journal.GET("/entries/:id", journalHandler.GetEntry)
			journal.PUT("/entries/:id", journalHandler.UpdateEntry)
			journal.DELETE("/entries/:id", journalHandler.DeleteEntry)

			// Streak & calendar
			journal.GET("/streak", journalHandler.GetStreak)
			journal.GET("/calendar", journalHandler.GetCalendar)

			// Images
			journal.POST("/entries/:id/images/presign", middleware.RateLimitByUser(rl, "presign", 20), journalHandler.PresignImage)
			journal.POST("/entries/:id/images/confirm", journalHandler.ConfirmImage)
			journal.DELETE("/images/:image_id", journalHandler.DeleteImage)

			// Groups
			// Invite acceptance requires auth: the invite is bound to the
			// redeeming user, so an anonymous caller has nobody to activate.
			journal.POST("/groups/join", journalHandler.JoinGroup)
			journal.POST("/groups", journalHandler.CreateGroup)
			journal.GET("/groups", journalHandler.ListGroups)
			journal.GET("/groups/:id", journalHandler.GetGroup)
			journal.PUT("/groups/:id", journalHandler.UpdateGroup)
			journal.DELETE("/groups/:id", journalHandler.DeleteGroup)
			journal.POST("/groups/:id/invite", journalHandler.InviteMember)
			journal.DELETE("/groups/:id/members/:user_id", journalHandler.RemoveMember)
			journal.POST("/groups/:id/entries", journalHandler.CreateGroupEntry)
			journal.GET("/groups/:id/entries", journalHandler.ListGroupEntries)
			journal.GET("/groups/:id/calendar", journalHandler.GetGroupCalendar)

			// Collections
			journal.POST("/collections", journalHandler.CreateCollection)
			journal.GET("/collections", journalHandler.ListCollections)
			journal.GET("/collections/:id", journalHandler.GetCollection)
			journal.PUT("/collections/:id", journalHandler.UpdateCollection)
			journal.DELETE("/collections/:id", journalHandler.DeleteCollection)
			journal.POST("/collections/:id/entries", journalHandler.AddEntryToCollection)
			journal.DELETE("/collections/:id/entries/:entry_id", journalHandler.RemoveEntryFromCollection)
		}

		// Admin routes: an authenticated user whose is_admin is set. Limited per
		// user rather than per IP — the old 10/min IP cap existed to slow guessing
		// of a shared header secret, which no longer exists, and it was tight
		// enough to trip on one panel load.
		admin := v1.Group("/admin")
		admin.Use(middleware.AuthRequired(authService))
		admin.Use(middleware.RateLimitByUser(rl, "admin", 120))
		admin.Use(middleware.NoStore())
		admin.Use(middleware.AdminRequired(userService))
		{
			admin.GET("/stats", adminHandler.GetStats)
			admin.GET("/users", adminHandler.ListUsers)
			admin.GET("/users/:id", adminHandler.GetUser)
			admin.DELETE("/users/:id", adminHandler.DeleteUser)
			admin.POST("/users/:id/send-password-reset", adminHandler.SendPasswordReset)
			admin.POST("/users/:id/revoke-sessions", adminHandler.RevokeUserSessions)
			admin.GET("/events", adminHandler.ListEvents)
			admin.GET("/feedback", feedbackHandler.List)
			admin.DELETE("/feedback/:id", feedbackHandler.Delete)
		}
	}

	return r
}
