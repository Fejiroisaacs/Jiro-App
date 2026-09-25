package services

import (
	"encoding/json"
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// The demo account's sample data: built once, then only slid forward (see demo.go).

type demoExercise struct {
	ID          uuid.UUID
	Name        string
	MuscleGroup string
	Notes       string
	CreatedAt   time.Time
}

type demoRoutine struct {
	ID        uuid.UUID
	Name      string
	DayOrder  int
	CreatedAt time.Time
}

type demoRoutineItem struct {
	RoutineID  uuid.UUID
	ExerciseID uuid.UUID
	TargetSets int
	TargetReps int
	OrderIndex int
}

type demoSession struct {
	ID        uuid.UUID
	RoutineID uuid.UUID
	StartedAt time.Time
	EndedAt   time.Time
	Notes     string
}

type demoSet struct {
	SessionID  uuid.UUID
	ExerciseID uuid.UUID
	SetNumber  int
	WeightKg   float64
	Reps       int
	RPE        int // 0 = not recorded
	IsPR       bool
	IsWarmup   bool
	CreatedAt  time.Time
}

type demoBodyWeight struct {
	Date     string
	WeightKg float64
}

type demoIngredient struct {
	Item   string `json:"item"`
	Amount string `json:"amount"`
}

type demoRecipe struct {
	ID           uuid.UUID
	Title        string
	Description  string
	Ingredients  string // JSON array of {item, amount}
	Instructions string // one step per line
	Tags         []string
	Nutrition    string // JSON object
	DietaryFlags string // JSON object
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

type demoTrial struct {
	RecipeID      uuid.UUID
	DateCooked    time.Time
	Notes         string
	Modifications string // JSON array of {item, change}
	Rating        int
}

type demoRecipeCollection struct {
	ID        uuid.UUID
	Name      string
	RecipeIDs []uuid.UUID
	CreatedAt time.Time
}

type demoMealPlanEntry struct {
	RecipeID    *uuid.UUID
	DayOfWeek   int // 0 = Monday, matching the planner
	Slot        string
	CustomLabel string
}

// demoGroceryItem is one grocery line; nil RecipeID means typed in by hand.
type demoGroceryItem struct {
	RecipeID    *uuid.UUID
	RecipeTitle string
	Item        string
	Amount      string
	Checked     bool
	CreatedAt   time.Time
}

type demoJournalEntry struct {
	ID        uuid.UUID
	Title     string
	Body      string
	Mood      string
	Tags      []string
	CreatedAt time.Time
}

type demoAccount struct {
	ID        uuid.UUID
	Name      string
	Type      string
	Balance   string
	CreatedAt time.Time
}

type demoCategory struct {
	ID    uuid.UUID
	Name  string
	Type  string
	Color string
}

type demoTransaction struct {
	AccountID   uuid.UUID
	CategoryID  *uuid.UUID
	Type        string
	Amount      string // signed: expenses and transfer sources are negative
	Description string
	Notes       string
	Date        string
	Recurring   string // "" or a recurrence_interval
	TransferTo  *uuid.UUID
	CreatedAt   time.Time
}

type demoBudget struct {
	CategoryID uuid.UUID
	Amount     string
	StartDate  string
}

type demoSnapshot struct {
	Date        string
	Assets      string
	Liabilities string
}

type demoDataset struct {
	SeedDay time.Time // UTC midnight of the insert day

	Exercises    []demoExercise
	SplitID      uuid.UUID
	Routines     []demoRoutine
	RoutineItems []demoRoutineItem
	SeriesID     uuid.UUID
	SeriesStart  time.Time
	Sessions     []demoSession
	Sets         []demoSet
	BodyWeights  []demoBodyWeight

	Recipes           []demoRecipe
	Trials            []demoTrial
	RecipeCollections []demoRecipeCollection
	MealPlanID        uuid.UUID
	MealPlanWeek      string // Monday of the seed week
	MealPlanEntries   []demoMealPlanEntry
	GroceryItems      []demoGroceryItem

	JournalEntries      []demoJournalEntry
	JournalCollectionID uuid.UUID
	JournalCollected    []uuid.UUID

	Accounts     []demoAccount
	Categories   []demoCategory
	Transactions []demoTransaction
	Budgets      []demoBudget
	Snapshots    []demoSnapshot
}

// demoSettings is the demo user's settings column.
const demoSettings = `{"weight_unit":"lbs","timezone":"America/New_York"}`

// demoTimeZone matches demoSettings; the demo's today is the New York day.
const demoTimeZone = "America/New_York"

// demoDate is t's New York date as UTC midnight; seed UTC hours 05-23 stay on that date.
func demoDate(t time.Time) time.Time {
	loc, err := time.LoadLocation(demoTimeZone)
	if err != nil { // tzdata is embedded (day.go), so this does not happen
		return utcDay(t)
	}
	y, m, d := t.In(loc).Date()
	return time.Date(y, m, d, 0, 0, 0, 0, time.UTC)
}

func utcDay(t time.Time) time.Time {
	t = t.UTC()
	return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, time.UTC)
}

// mondayOf returns the Monday starting t's week (UTC), as parseWeekStart does.
func mondayOf(t time.Time) time.Time {
	d := utcDay(t)
	return d.AddDate(0, 0, -((int(d.Weekday()) + 6) % 7))
}

func lbsToKg(lbs float64) float64 {
	return math.Round(lbs*0.45359237*100) / 100
}

func money(v float64) string { return fmt.Sprintf("%.2f", v) }

// buildDemoDataset returns the sample data for a seed at now.
func buildDemoDataset(now time.Time) *demoDataset {
	d0 := utcDay(now)
	at := func(offset, hh, mm int) time.Time {
		return d0.AddDate(0, 0, offset).Add(time.Duration(hh)*time.Hour + time.Duration(mm)*time.Minute)
	}
	date := func(offset int) string { return d0.AddDate(0, 0, offset).Format("2006-01-02") }

	ds := &demoDataset{SeedDay: d0}
	buildDemoJym(ds, at, date)
	buildDemoCulinara(ds, at, now)
	buildDemoJournal(ds, at)
	buildDemoLedger(ds, at, date)
	return ds
}

// ─── Jym ─────────────────────────────────────────────────────────────────────

type demoLift struct {
	name, muscle, notes string
	sets, reps          int
	lbs                 [6]float64 // working weight on each of the six sessions of its day
	priorLbs            float64    // best set from before the demo's six weeks
	priorReps           int
	warmupLbs           float64 // 0 = no warm-up set
}

func buildDemoJym(ds *demoDataset, at func(int, int, int) time.Time, date func(int) string) {
	days := []struct {
		name  string
		lifts []demoLift
	}{
		{"Push", []demoLift{
			{"Bench Press", "Chest", "Pause the first rep on the chest.", 4, 6, [6]float64{155, 160, 160, 165, 170, 175}, 170, 5, 95},
			{"Overhead Press", "Shoulders", "", 3, 8, [6]float64{95, 95, 100, 100, 105, 105}, 105, 6, 0},
			{"Incline Dumbbell Press", "Chest", "Weight is per dumbbell.", 3, 10, [6]float64{50, 50, 55, 55, 55, 60}, 60, 8, 0},
			{"Lateral Raise", "Shoulders", "", 3, 12, [6]float64{20, 20, 20, 25, 25, 25}, 25, 12, 0},
			{"Tricep Pushdown", "Triceps", "Rope attachment.", 3, 12, [6]float64{50, 55, 55, 60, 60, 65}, 70, 10, 0},
		}},
		{"Pull", []demoLift{
			{"Deadlift", "Back", "Mixed grip on the top set only.", 3, 5, [6]float64{245, 255, 265, 275, 285, 295}, 285, 3, 135},
			{"Barbell Row", "Back", "", 4, 8, [6]float64{135, 135, 140, 145, 145, 150}, 150, 6, 0},
			{"Lat Pulldown", "Back", "", 3, 10, [6]float64{120, 120, 125, 130, 130, 135}, 140, 8, 0},
			{"Dumbbell Curl", "Biceps", "", 3, 12, [6]float64{25, 25, 30, 30, 30, 35}, 35, 8, 0},
		}},
		{"Legs", []demoLift{
			{"Back Squat", "Legs", "High bar, belt from 225 up.", 4, 6, [6]float64{205, 215, 215, 225, 235, 240}, 235, 5, 135},
			{"Romanian Deadlift", "Legs", "", 3, 8, [6]float64{165, 175, 175, 185, 185, 195}, 205, 6, 0},
			{"Leg Press", "Legs", "", 3, 12, [6]float64{270, 290, 310, 310, 330, 340}, 320, 12, 0},
		}},
	}

	ds.SplitID = uuid.New()
	ds.SeriesID = uuid.New()

	// Eighteen sessions over six weeks, Push/Pull/Legs in turn, the last one yesterday.
	sessionDays := []int{-40, -38, -36, -33, -31, -29, -26, -24, -22, -19, -17, -15, -12, -10, -8, -5, -3, -1}
	ds.SeriesStart = at(sessionDays[0], 10, 30)

	exerciseIDs := map[string]uuid.UUID{}
	routineIDs := make([]uuid.UUID, len(days))
	for di, day := range days {
		routineIDs[di] = uuid.New()
		ds.Routines = append(ds.Routines, demoRoutine{
			ID: routineIDs[di], Name: day.name, DayOrder: di + 1, CreatedAt: at(-44, 21, 12+di),
		})
		for li, lift := range day.lifts {
			id := uuid.New()
			exerciseIDs[lift.name] = id
			ds.Exercises = append(ds.Exercises, demoExercise{
				ID: id, Name: lift.name, MuscleGroup: lift.muscle, Notes: lift.notes,
				CreatedAt: at(-44, 20, 40+len(ds.Exercises)),
			})
			ds.RoutineItems = append(ds.RoutineItems, demoRoutineItem{
				RoutineID: routineIDs[di], ExerciseID: id, TargetSets: lift.sets, TargetReps: lift.reps, OrderIndex: li,
			})
		}
	}

	sessionNotes := map[int]string{
		0:  "First day of the new block. Kept everything a little light on purpose.",
		4:  "Deadlifts moved well. Grip started to go on the last row set.",
		10: "Short on time, rushed the rest between pulldown sets.",
		11: "Squats felt heavy, slept badly. Lost a rep on the last set.",
		12: "Bench 170 for 6, first time. Paused reps are paying off.",
		13: "285 for 5 on deadlift. Last rep was slow but clean.",
		15: "175 on bench. Five on the last set, will stay here next week.",
		16: "295 for 5. Grip held with chalk.",
		17: "Squat PR at 240. Leg press feels easy now, time to add more.",
	}

	type best struct {
		lbs  float64
		reps int
	}
	bests := map[string]best{}
	for _, day := range days {
		for _, lift := range day.lifts {
			bests[lift.name] = best{lift.priorLbs, lift.priorReps}
		}
	}

	for si, offset := range sessionDays {
		di := si % len(days)
		round := si / len(days)
		start := at(offset, 10, 20+(si*7)%25)
		sess := demoSession{ID: uuid.New(), RoutineID: routineIDs[di], StartedAt: start, Notes: sessionNotes[si]}
		clock := start.Add(4 * time.Minute)

		for _, lift := range days[di].lifts {
			exID := exerciseIDs[lift.name]
			setNum := 1
			if lift.warmupLbs > 0 {
				ds.Sets = append(ds.Sets, demoSet{
					SessionID: sess.ID, ExerciseID: exID, SetNumber: setNum,
					WeightKg: lbsToKg(lift.warmupLbs), Reps: 8, IsWarmup: true, CreatedAt: clock,
				})
				setNum++
				clock = clock.Add(2 * time.Minute)
			}
			weight := lift.lbs[round]
			increased := round > 0 && weight > lift.lbs[round-1]
			for s := 0; s < lift.sets; s++ {
				reps := lift.reps
				// The session after a weight jump, the last set tends to lose a rep.
				if increased && s == lift.sets-1 && lift.reps <= 8 {
					reps--
				}
				rpe := 7 + s
				if rpe > 9 {
					rpe = 9
				}
				// Same PR rule as JymService.LogSet.
				b := bests[lift.name]
				isPR := weight > b.lbs || (weight == b.lbs && reps > b.reps)
				if isPR {
					bests[lift.name] = best{weight, reps}
				}
				ds.Sets = append(ds.Sets, demoSet{
					SessionID: sess.ID, ExerciseID: exID, SetNumber: setNum,
					WeightKg: lbsToKg(weight), Reps: reps, RPE: rpe, IsPR: isPR, CreatedAt: clock,
				})
				setNum++
				clock = clock.Add(3 * time.Minute)
			}
			clock = clock.Add(2 * time.Minute)
		}
		sess.EndedAt = clock
		ds.Sessions = append(ds.Sessions, sess)
	}

	// Weekly weigh-ins, drifting down slowly.
	for i, lbs := range []float64{181.4, 180.6, 180.9, 179.8, 179.2, 178.6, 178.1} {
		ds.BodyWeights = append(ds.BodyWeights, demoBodyWeight{Date: date(-43 + i*7), WeightKg: lbsToKg(lbs)})
	}
}

// ─── Culinara ────────────────────────────────────────────────────────────────

func ingredientsJSON(pairs ...string) string {
	var b strings.Builder
	b.WriteByte('[')
	for i := 0; i+1 < len(pairs); i += 2 {
		if i > 0 {
			b.WriteByte(',')
		}
		fmt.Fprintf(&b, `{"item":%q,"amount":%q}`, pairs[i], pairs[i+1])
	}
	b.WriteByte(']')
	return b.String()
}

func buildDemoCulinara(ds *demoDataset, at func(int, int, int) time.Time, now time.Time) {
	add := func(created, updated int, title, desc, ingredients, steps string, tags []string, nutrition, flags string) uuid.UUID {
		id := uuid.New()
		ds.Recipes = append(ds.Recipes, demoRecipe{
			ID: id, Title: title, Description: desc, Ingredients: ingredients,
			Instructions: strings.TrimSpace(steps), Tags: tags, Nutrition: nutrition, DietaryFlags: flags,
			CreatedAt: at(created, 23, 5), UpdatedAt: at(updated, 23, 40),
		})
		return id
	}

	tikka := add(-52, -9, "Weeknight Chicken Tikka Masala",
		"Marinate in the morning, dinner in 30 minutes. Makes enough for two lunches.",
		ingredientsJSON(
			"Chicken thighs, boneless", "1.5 lb",
			"Plain Greek yogurt", "1/2 cup",
			"Garam masala", "2 tbsp",
			"Garlic, grated", "4 cloves",
			"Ginger, grated", "1 tbsp",
			"Crushed tomatoes", "1 can (28 oz)",
			"Heavy cream", "1/2 cup",
			"Yellow onion, diced", "1",
			"Basmati rice", "1.5 cups",
		), `
Mix the yogurt with half the garam masala, half the garlic and a big pinch of salt. Coat the chicken and leave it for at least an hour.
Broil the chicken on a sheet pan for 8 to 10 minutes until charred at the edges, then cut into pieces.
Soften the onion in butter, add the rest of the garlic, the ginger and the garam masala and cook for a minute.
Add the tomatoes and simmer for 15 minutes, then stir in the cream.
Add the chicken and simmer 5 more minutes. Serve over rice.`,
		[]string{"dinner", "indian", "meal prep"},
		`{"calories":612,"protein":44,"carbs":58,"fat":22}`, `{"gluten_free":true,"nut_free":true}`)

	oats := add(-47, -30, "Overnight Oats with Berries",
		"Five minutes the night before. The chia seeds are what make it thick.",
		ingredientsJSON(
			"Rolled oats", "1/2 cup",
			"Milk", "1/2 cup",
			"Greek yogurt", "1/4 cup",
			"Chia seeds", "1 tbsp",
			"Maple syrup", "2 tsp",
			"Frozen mixed berries", "1/2 cup",
		), `
Stir the oats, milk, yogurt, chia and maple syrup together in a jar.
Top with the frozen berries, close the lid and refrigerate overnight.
Stir before eating. Add a splash of milk if it is too thick.`,
		[]string{"breakfast", "quick", "meal prep"},
		`{"calories":348,"protein":16,"carbs":52,"fat":8}`, `{"vegetarian":true,"nut_free":true}`)

	salmon := add(-40, -12, "Sheet Pan Salmon with Broccoli",
		"One pan, 20 minutes, almost no dishes.",
		ingredientsJSON(
			"Salmon fillets", "2 (about 12 oz)",
			"Broccoli florets", "1 large head",
			"Olive oil", "2 tbsp",
			"Lemon", "1",
			"Garlic powder", "1 tsp",
			"Smoked paprika", "1/2 tsp",
		), `
Heat the oven to 425F.
Toss the broccoli with half the oil, salt and pepper and roast for 8 minutes.
Push the broccoli aside, add the salmon, brush with the rest of the oil and season with garlic powder, paprika and salt.
Roast 10 to 12 minutes until the salmon flakes. Squeeze the lemon over everything.`,
		[]string{"dinner", "quick", "high protein"},
		`{"calories":431,"protein":38,"carbs":12,"fat":26}`, `{"gluten_free":true,"dairy_free":true,"nut_free":true}`)

	tacos := add(-36, -36, "Black Bean Tacos",
		"Pantry dinner for the nights the fridge is empty.",
		ingredientsJSON(
			"Black beans, drained", "2 cans",
			"Cumin", "1 tsp",
			"Chili powder", "1 tsp",
			"Corn tortillas", "8",
			"Red cabbage, shredded", "2 cups",
			"Lime", "2",
			"Feta, crumbled", "1/3 cup",
			"Avocado", "1",
		), `
Warm the beans in a pan with the cumin, chili powder, a splash of water and salt. Mash about half of them.
Toss the cabbage with the juice of one lime and a pinch of salt.
Char the tortillas over a gas flame or in a dry pan.
Fill with beans, cabbage, avocado and feta. Serve with lime wedges.`,
		[]string{"dinner", "vegetarian", "quick"},
		`{"calories":489,"protein":19,"carbs":71,"fat":15}`, `{"vegetarian":true,"gluten_free":true,"nut_free":true}`)

	bowls := add(-33, -5, "Greek Chicken Rice Bowls",
		"Sunday meal prep. Keeps for four days if the tzatziki goes in a separate container.",
		ingredientsJSON(
			"Chicken breast", "2 lb",
			"Lemon juice", "3 tbsp",
			"Dried oregano", "2 tsp",
			"Jasmine rice", "2 cups",
			"Cucumber", "1",
			"Cherry tomatoes", "1 pint",
			"Red onion", "1/2",
			"Tzatziki", "1 cup",
		), `
Marinate the chicken in lemon juice, oregano, olive oil, garlic and salt for 30 minutes.
Cook the rice.
Grill or pan sear the chicken, about 6 minutes per side, rest it and slice.
Chop the cucumber, tomatoes and onion.
Divide everything into four containers with tzatziki on the side.`,
		[]string{"lunch", "meal prep", "high protein"},
		`{"calories":556,"protein":49,"carbs":61,"fat":11}`, `{"gluten_free":true,"nut_free":true}`)

	risotto := add(-28, -22, "Mushroom Risotto",
		"Slow Sunday cooking. Worth the stirring.",
		ingredientsJSON(
			"Arborio rice", "1.5 cups",
			"Cremini mushrooms, sliced", "1 lb",
			"Shallots, minced", "2",
			"Dry white wine", "1/2 cup",
			"Vegetable stock", "5 cups",
			"Parmesan, grated", "3/4 cup",
			"Butter", "3 tbsp",
			"Thyme", "4 sprigs",
		), `
Keep the stock warm in a small pot.
Brown the mushrooms in butter in batches, season and set aside.
Soften the shallots, add the rice and toast for 2 minutes.
Add the wine and stir until it is absorbed.
Add stock one ladle at a time, stirring, until the rice is creamy but still has a bite, about 20 minutes.
Stir in the mushrooms, parmesan, thyme leaves and a last knob of butter.`,
		[]string{"dinner", "vegetarian"},
		`{"calories":528,"protein":17,"carbs":74,"fat":17}`, `{"vegetarian":true,"gluten_free":true,"nut_free":true}`)

	pancakes := add(-21, -21, "Banana Oat Pancakes",
		"Three ingredients plus whatever is in the cupboard. Blender does the work.",
		ingredientsJSON(
			"Ripe bananas", "2",
			"Eggs", "2",
			"Rolled oats", "1 cup",
			"Baking powder", "1 tsp",
			"Cinnamon", "1/2 tsp",
		), `
Blend everything until smooth and let it sit for 5 minutes.
Cook small pancakes in a buttered pan over medium heat, about 2 minutes per side.
Serve with yogurt and a little maple syrup.`,
		[]string{"breakfast", "quick"},
		`{"calories":312,"protein":13,"carbs":49,"fat":8}`, `{"vegetarian":true,"dairy_free":true,"nut_free":true}`)

	chili := add(-15, -3, "Turkey Chili",
		"Big pot, freezes well. Better on day two.",
		ingredientsJSON(
			"Ground turkey", "2 lb",
			"Kidney beans", "2 cans",
			"Diced tomatoes", "1 can (28 oz)",
			"Yellow onion", "1",
			"Bell peppers", "2",
			"Chili powder", "3 tbsp",
			"Cumin", "2 tsp",
			"Dark chocolate", "1 square",
		), `
Brown the turkey in a large pot and set aside.
Cook the onion and peppers until soft, then add the spices for a minute.
Add the tomatoes, beans, turkey and a cup of water.
Simmer uncovered for 45 minutes, stirring now and then.
Stir in the chocolate and season. Top with sour cream and green onion.`,
		[]string{"dinner", "meal prep", "high protein"},
		`{"calories":468,"protein":42,"carbs":37,"fat":16}`, `{"gluten_free":true,"dairy_free":true,"nut_free":true}`)

	ds.Trials = []demoTrial{
		{tikka, at(-24, 23, 50), "Too much cream, the sauce went a bit flat. Also needed more salt.", `[{"item":"Heavy cream","change":"used 3/4 cup"}]`, 4},
		{tikka, at(-9, 23, 45), "Much better. Broiling the chicken first is the whole trick.", `[{"item":"Heavy cream","change":"back to 1/2 cup"},{"item":"Kashmiri chili","change":"added 1 tsp"}]`, 5},
		{risotto, at(-22, 23, 30), "Used cold stock and it took forever. Rice was still a little chalky.", `[{"item":"Vegetable stock","change":"cold, straight from the carton"}]`, 3},
		{salmon, at(-12, 23, 20), "Perfect. Pulled it at 11 minutes.", `[]`, 5},
		{tacos, at(-13, 23, 30), "Made these to celebrate. Quick pickled onions made a big difference.", `[{"item":"Red onion","change":"quick pickled in lime"}]`, 5},
		{bowls, at(-11, 23, 40), "Prepped four lunches. Marinated the chicken overnight this time.", `[]`, 4},
		{oats, at(-10, 23, 15), "Half the chia, it was getting too thick by day three.", `[{"item":"Chia seeds","change":"1/2 tbsp"}]`, 4},
		{chili, at(-3, 23, 55), "Doubled the batch and froze half.", `[{"item":"Chili powder","change":"4 tbsp"}]`, 4},
		{bowls, at(-2, 23, 35), "Second round of prep. Added cucumber and extra feta.", `[{"item":"Feta","change":"doubled"}]`, 5},
		{pancakes, at(-1, 23, 10), "Used the last two bananas. Froze the extras for next week.", `[]`, 4},
	}

	ds.RecipeCollections = []demoRecipeCollection{
		{ID: uuid.New(), Name: "Meal prep", RecipeIDs: []uuid.UUID{tikka, bowls, chili}, CreatedAt: at(-30, 23, 10)},
		{ID: uuid.New(), Name: "Breakfasts", RecipeIDs: []uuid.UUID{oats, pancakes}, CreatedAt: at(-20, 23, 10)},
	}

	ds.MealPlanID = uuid.New()
	ds.MealPlanWeek = mondayOf(now).Format("2006-01-02")
	r := func(id uuid.UUID) *uuid.UUID { return &id }
	ds.MealPlanEntries = []demoMealPlanEntry{
		{r(oats), 0, "breakfast", ""},
		{r(bowls), 0, "lunch", ""},
		{r(salmon), 0, "dinner", ""},
		{r(oats), 1, "breakfast", ""},
		{r(bowls), 1, "lunch", ""},
		{r(tikka), 1, "dinner", ""},
		{r(bowls), 2, "lunch", ""},
		{nil, 2, "dinner", "Leftover tikka masala"},
		{r(oats), 3, "breakfast", ""},
		{r(bowls), 3, "lunch", ""},
		{r(tacos), 3, "dinner", ""},
		{nil, 4, "dinner", "Dinner out with Sam"},
		{r(pancakes), 5, "breakfast", ""},
		{r(chili), 5, "dinner", ""},
		{r(risotto), 6, "dinner", ""},
	}

	// The grocery list: this week's meal prep recipes, some ticked, plus two manual items.
	titles := map[uuid.UUID]string{}
	ingredients := map[uuid.UUID]string{}
	for _, rec := range ds.Recipes {
		titles[rec.ID] = rec.Title
		ingredients[rec.ID] = rec.Ingredients
	}
	checked := map[string]bool{"Rolled oats": true, "Milk": true, "Jasmine rice": true}
	listAt := at(-1, 21, 30)
	for _, rid := range []uuid.UUID{oats, bowls} {
		var ing []demoIngredient
		_ = json.Unmarshal([]byte(ingredients[rid]), &ing)
		for _, in := range ing {
			ds.GroceryItems = append(ds.GroceryItems, demoGroceryItem{
				RecipeID: r(rid), RecipeTitle: titles[rid], Item: in.Item, Amount: in.Amount,
				Checked: checked[in.Item], CreatedAt: listAt.Add(time.Duration(len(ds.GroceryItems)) * time.Second),
			})
		}
	}
	for _, m := range []struct{ item, amount string }{{"Coffee beans", "1 bag"}, {"Paper towels", ""}} {
		ds.GroceryItems = append(ds.GroceryItems, demoGroceryItem{
			Item: m.item, Amount: m.amount, CreatedAt: at(-1, 21, 45).Add(time.Duration(len(ds.GroceryItems)) * time.Second),
		})
	}
}

// ─── Journaly ────────────────────────────────────────────────────────────────

func buildDemoJournal(ds *demoDataset, at func(int, int, int) time.Time) {
	add := func(offset, hh, mm int, title, mood string, tags []string, body string) uuid.UUID {
		id := uuid.New()
		ds.JournalEntries = append(ds.JournalEntries, demoJournalEntry{
			ID: id, Title: title, Body: strings.TrimSpace(body), Mood: mood, Tags: tags, CreatedAt: at(offset, hh, mm),
		})
		return id
	}

	add(-40, 23, 12, "New block", "energised", []string{"training"}, `
Started the new push pull legs program today. Kept the weights lighter than I wanted to, which was annoying, but the plan is to add five pounds whenever every set hits the top of the range.

Goal for the next six weeks: bench 175 and a clean 285 deadlift for five.`)

	add(-31, 22, 40, "", "tired", []string{"sleep", "work"}, `
Long day. The quarterly review ran two hours over and I ate lunch at 4. Skipped the evening walk. Going to bed early and not looking at my phone.`)

	add(-29, 23, 30, "Sunday reset", "calm", []string{"routine", "cooking"}, `
Did the whole Sunday thing: laundry, groceries, meal prepped the Greek chicken bowls for the week. Called Mom for an hour. She wants us to come up in May.

Nice to start the week with the fridge already full.`)

	add(-26, 21, 15, "", "stressed", []string{"work", "money"}, `
Car needs new brakes, $480. Not the end of the world but it wipes out what I had set aside for the month. Moving the concert money back into savings to make up for it.`)

	add(-22, 23, 50, "Risotto attempt", "happy", []string{"cooking"}, `
Made mushroom risotto for the first time. It was fine, not great. I used cold stock straight from the carton and it took forever to come together. Next time warm it first like every recipe says.

Sam said it was good, which is either true or kind.`)

	add(-19, 23, 5, "", "grateful", []string{"friends"}, `
Priya came over and we talked until midnight. It has been way too long since I just sat and talked with someone without checking the time. Want to do that more.`)

	add(-17, 22, 20, "", "anxious", []string{"work"}, `
Presentation to the leadership team on Thursday. I know the material but I keep rehearsing the opening in my head. Wrote out the first two minutes word for word so I can stop thinking about it.`)

	add(-15, 23, 45, "", "tired", []string{"training", "sleep"}, `
Squats felt awful today, everything was heavy. Only slept five hours. Got through it but lost a rep on the last set. Note to self: the workout is not the problem, the sleep is.`)

	add(-14, 23, 15, "", "anxious", []string{"work"}, `
Presentation is tomorrow. Ran through the slides twice after dinner and cut the part about the old reporting setup, nobody needs the history. Laying out clothes tonight so the morning is easy.`)

	add(-13, 23, 40, "It went fine", "happy", []string{"work", "wins"}, `
The presentation went well. They asked two questions I had actually prepared for. My manager stopped by afterwards to say it was clear and well paced.

Celebrated with tacos.`)

	add(-12, 23, 10, "", "energised", []string{"training", "wins"}, `
Benched 170 for six. First time ever. The paused reps have made the bottom feel so much stronger. Next week 175.`)

	add(-8, 23, 25, "Budget check", "calm", []string{"money"}, `
Sat down with the numbers for the month. Food is over again, mostly takeout on the late nights. Everything else is fine. Savings are up about $400 from last month, which is the whole point.

Plan: cook on Wednesdays instead of ordering.`)

	add(-3, 23, 35, "", "grateful", []string{"family", "cooking"}, `
Big pot of turkey chili, froze half of it for the busy weeks. Mom called to ask for the recipe, which has never happened before.`)

	add(-2, 21, 50, "", "calm", []string{"routine"}, `
Quiet evening. Read for an hour, went to bed at 10:30. More days like this, please.`)

	add(-1, 23, 20, "Six weeks done", "happy", []string{"training", "wins"}, `
Last session of the block. Squatted 240 for six, a new best. Bench hit 175 and the deadlift went 295 for five earlier this week. Both goals from the first entry done.

Taking a lighter week and then starting the next block. Proud of this one.`)

	ds.JournalCollectionID = uuid.New()
	// The training notes collection: every entry tagged training.
	for _, e := range ds.JournalEntries {
		for _, t := range e.Tags {
			if t == "training" {
				ds.JournalCollected = append(ds.JournalCollected, e.ID)
				break
			}
		}
	}
}

// ─── Ledger ──────────────────────────────────────────────────────────────────

func buildDemoLedger(ds *demoDataset, at func(int, int, int) time.Time, date func(int) string) {
	checking := demoAccount{uuid.New(), "Everyday Checking", "checking", "3482.16", at(-75, 14, 2)}
	savings := demoAccount{uuid.New(), "High-Yield Savings", "savings", "12406.55", at(-75, 14, 5)}
	card := demoAccount{uuid.New(), "Visa Card", "credit", "-684.29", at(-75, 14, 9)}
	ds.Accounts = []demoAccount{checking, savings, card}

	// Same names and colours as LedgerService.SeedDefaultCategories.
	cats := map[string]uuid.UUID{}
	for _, c := range []struct{ name, typ, color string }{
		{"Housing", "expense", "#8D6E63"},
		{"Food & Drink", "expense", "#E57373"},
		{"Transport", "expense", "#64B5F6"},
		{"Health", "expense", "#81C784"},
		{"Entertainment", "expense", "#FFD54F"},
		{"Shopping", "expense", "#F48FB1"},
		{"Utilities", "expense", "#90A4AE"},
		{"Subscriptions", "expense", "#CE93D8"},
		{"Other", "expense", "#BCAAA4"},
		{"Salary", "income", "#66BB6A"},
		{"Freelance", "income", "#4DB6AC"},
		{"Investment", "income", "#FFA726"},
		{"Gift", "income", "#AB47BC"},
		{"Other Income", "income", "#78909C"},
	} {
		id := uuid.New()
		cats[c.name] = id
		ds.Categories = append(ds.Categories, demoCategory{id, c.name, c.typ, c.color})
	}
	cat := func(name string) *uuid.UUID {
		id, ok := cats[name]
		if !ok {
			panic("demo ledger: unknown category " + name)
		}
		return &id
	}

	add := func(offset int, acct demoAccount, category, typ string, amount float64, desc, notes, recurring string) {
		if typ == "expense" {
			amount = -amount
		}
		ds.Transactions = append(ds.Transactions, demoTransaction{
			AccountID: acct.ID, CategoryID: cat(category), Type: typ, Amount: money(amount),
			Description: desc, Notes: notes, Date: date(offset), Recurring: recurring,
			CreatedAt: at(offset, 23, 30),
		})
	}
	transfer := func(offset int, from, to demoAccount, amount float64, desc string) {
		f, t := from.ID, to.ID
		ds.Transactions = append(ds.Transactions,
			demoTransaction{AccountID: from.ID, Type: "transfer", Amount: money(-amount), Description: desc, Date: date(offset), TransferTo: &t, CreatedAt: at(offset, 23, 31)},
			demoTransaction{AccountID: to.ID, Type: "transfer", Amount: money(amount), Description: desc, Date: date(offset), TransferTo: &f, CreatedAt: at(offset, 23, 31)},
		)
	}

	// Income: biweekly paycheck, one freelance job.
	for _, o := range []int{-56, -42, -28, -14} {
		add(o, checking, "Salary", "income", 2184.62, "Paycheck", "", "biweekly")
	}
	add(-37, checking, "Freelance", "income", 650.00, "Logo design for Priya's bakery", "Invoice #014", "")
	add(-30, savings, "Investment", "income", 38.71, "Savings interest", "", "monthly")

	// Fixed monthly costs.
	for _, o := range []int{-55, -25} {
		add(o, checking, "Housing", "expense", 1650.00, "Rent", "", "monthly")
	}
	add(-51, checking, "Utilities", "expense", 81.37, "Con Edison", "", "monthly")
	add(-21, checking, "Utilities", "expense", 74.92, "Con Edison", "", "monthly")
	add(-48, checking, "Utilities", "expense", 60.00, "Internet", "", "monthly")
	add(-18, checking, "Utilities", "expense", 60.00, "Internet", "", "monthly")
	add(-53, card, "Subscriptions", "expense", 11.99, "Spotify", "", "monthly")
	add(-23, card, "Subscriptions", "expense", 11.99, "Spotify", "", "monthly")
	add(-46, card, "Subscriptions", "expense", 15.49, "Netflix", "", "monthly")
	add(-16, card, "Subscriptions", "expense", 15.49, "Netflix", "", "monthly")
	add(-50, checking, "Health", "expense", 34.99, "Gym membership", "", "monthly")
	add(-20, checking, "Health", "expense", 34.99, "Gym membership", "", "monthly")
	add(-44, card, "Transport", "expense", 127.00, "Metro card", "", "monthly")
	add(-14, card, "Transport", "expense", 127.00, "Metro card", "", "monthly")

	// Weekly groceries and the rest of life.
	groceries := []struct {
		o int
		v float64
		d string
	}{
		{-57, 84.37, "Trader Joe's"}, {-50, 112.09, "Whole Foods"}, {-43, 67.45, "Trader Joe's"},
		{-36, 94.18, "Trader Joe's"}, {-29, 121.63, "Costco"}, {-22, 78.02, "Trader Joe's"},
		{-15, 88.54, "Whole Foods"}, {-8, 73.91, "Trader Joe's"}, {-1, 102.26, "Trader Joe's"},
	}
	for _, g := range groceries {
		add(g.o, card, "Food & Drink", "expense", g.v, g.d, "", "")
	}
	for _, e := range []struct {
		o           int
		acct        demoAccount
		cat         string
		v           float64
		desc, notes string
	}{
		{-54, card, "Food & Drink", 23.40, "Sweetgreen", ""},
		{-52, card, "Food & Drink", 41.85, "Thai Basil", "Dinner with Sam"},
		{-49, card, "Entertainment", 32.00, "Movie tickets", ""},
		{-47, card, "Food & Drink", 18.75, "Joe Coffee", ""},
		{-45, card, "Shopping", 64.99, "Running shoes", "On sale"},
		{-41, card, "Food & Drink", 36.12, "Uber Eats", ""},
		{-26, checking, "Transport", 480.00, "Brake pads and rotors", "Midas"},
		{-38, card, "Food & Drink", 27.30, "Chipotle", ""},
		{-34, card, "Entertainment", 18.00, "Bowling", ""},
		{-32, card, "Shopping", 42.17, "Target", ""},
		{-31, card, "Food & Drink", 54.60, "Lucali", "Pizza with Priya"},
		{-27, card, "Health", 21.48, "CVS", ""},
		{-26, card, "Food & Drink", 31.08, "Uber Eats", ""},
		{-24, card, "Other", 25.00, "Haircut", ""},
		{-19, card, "Shopping", 89.00, "Birthday gift for Mom", ""},
		{-17, card, "Food & Drink", 19.64, "Chipotle", ""},
		{-13, card, "Food & Drink", 47.22, "Los Tacos No. 1", "Celebration tacos"},
		{-12, card, "Entertainment", 14.99, "Book", ""},
		{-11, card, "Food & Drink", 33.87, "Uber Eats", ""},
		{-9, card, "Food & Drink", 16.50, "Joe Coffee", ""},
		{-7, card, "Shopping", 28.43, "Amazon", "Resistance bands"},
		{-5, card, "Food & Drink", 38.26, "Thai Basil", ""},
		{-4, card, "Transport", 24.81, "Uber", ""},
		{-2, card, "Food & Drink", 12.35, "Bagel place", ""},
	} {
		add(e.o, e.acct, e.cat, "expense", e.v, e.desc, e.notes, "")
	}

	transfer(-55, checking, savings, 400.00, "Monthly savings")
	transfer(-25, checking, savings, 400.00, "Monthly savings")
	transfer(-40, checking, card, 812.44, "Card payment")
	transfer(-10, checking, card, 697.18, "Card payment")

	monthStart := ds.SeedDay.AddDate(0, 0, 1-ds.SeedDay.Day()).Format("2006-01-02")
	for _, b := range []struct {
		cat    string
		amount float64
	}{{"Food & Drink", 600}, {"Entertainment", 120}, {"Shopping", 200}, {"Transport", 180}} {
		ds.Budgets = append(ds.Budgets, demoBudget{CategoryID: *cat(b.cat), Amount: money(b.amount), StartDate: monthStart})
	}

	for _, s := range []struct {
		o    int
		a, l float64
	}{
		{-151, 13208.40, 1122.35}, {-121, 13987.12, 963.08}, {-91, 14402.77, 1204.51},
		{-61, 14851.30, 877.62}, {-31, 15320.94, 942.10}, {-1, 15888.71, 684.29},
	} {
		ds.Snapshots = append(ds.Snapshots, demoSnapshot{Date: date(s.o), Assets: money(s.a), Liabilities: money(s.l)})
	}
}

// ─── Insert ──────────────────────────────────────────────────────────────────

func nullIfEmpty(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

// queue adds every INSERT for the dataset to b, in foreign-key order.
func (ds *demoDataset) queue(b *pgx.Batch, userID uuid.UUID) {
	for _, e := range ds.Exercises {
		b.Queue(`INSERT INTO exercises (id, user_id, name, muscle_group, notes, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$6)`,
			e.ID, userID, e.Name, e.MuscleGroup, nullIfEmpty(e.Notes), e.CreatedAt)
	}
	splitCreated := ds.Routines[0].CreatedAt.Add(-time.Minute)
	b.Queue(`INSERT INTO splits (id, user_id, name, description, visibility, tags, created_at, updated_at) VALUES ($1,$2,$3,$4,'private',$5,$6,$6)`,
		ds.SplitID, userID, "Push Pull Legs",
		"Three days a week. Add five pounds once every set hits the top of the rep range.",
		[]string{"strength", "3 days"}, splitCreated)
	for _, r := range ds.Routines {
		b.Queue(`INSERT INTO routines (id, user_id, split_id, name, day_order, created_at) VALUES ($1,$2,$3,$4,$5,$6)`,
			r.ID, userID, ds.SplitID, r.Name, r.DayOrder, r.CreatedAt)
	}
	for _, it := range ds.RoutineItems {
		b.Queue(`INSERT INTO routine_items (routine_id, exercise_id, target_sets, target_reps, order_index) VALUES ($1,$2,$3,$4,$5)`,
			it.RoutineID, it.ExerciseID, it.TargetSets, it.TargetReps, it.OrderIndex)
	}
	b.Queue(`INSERT INTO split_series (id, user_id, split_id, name, duration_type, target_weeks, started_at, created_at) VALUES ($1,$2,$3,$4,'weeks',6,$5,$5)`,
		ds.SeriesID, userID, ds.SplitID, "Spring strength block", ds.SeriesStart)
	for _, s := range ds.Sessions {
		b.Queue(`INSERT INTO sessions (id, user_id, routine_id, series_id, started_at, ended_at, notes, session_type) VALUES ($1,$2,$3,$4,$5,$6,$7,'normal')`,
			s.ID, userID, s.RoutineID, ds.SeriesID, s.StartedAt, s.EndedAt, nullIfEmpty(s.Notes))
	}
	for _, s := range ds.Sets {
		var rpe *int
		if s.RPE > 0 {
			v := s.RPE
			rpe = &v
		}
		b.Queue(`INSERT INTO session_sets (session_id, exercise_id, set_number, weight, reps_performed, rpe, is_pr, is_warmup, created_at) VALUES ($1,$2,$3,$4::numeric,$5,$6,$7,$8,$9)`,
			s.SessionID, s.ExerciseID, s.SetNumber, money(s.WeightKg), s.Reps, rpe, s.IsPR, s.IsWarmup, s.CreatedAt)
	}
	for _, w := range ds.BodyWeights {
		b.Queue(`INSERT INTO body_weights (user_id, recorded_at, weight_kg, created_at) VALUES ($1,$2::date,$3::numeric,$2::date + time '12:05')`,
			userID, w.Date, money(w.WeightKg))
	}

	for _, r := range ds.Recipes {
		b.Queue(`INSERT INTO recipes (id, user_id, title, description, base_ingredients, instructions, tags, nutrition, dietary_flags, is_public, created_at, updated_at)
		         VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8::jsonb,$9::jsonb,false,$10,$11)`,
			r.ID, userID, r.Title, r.Description, r.Ingredients, r.Instructions, r.Tags, r.Nutrition, r.DietaryFlags, r.CreatedAt, r.UpdatedAt)
	}
	for _, t := range ds.Trials {
		b.Queue(`INSERT INTO recipe_trials (recipe_id, date_cooked, notes, modifications, rating, created_at) VALUES ($1,$2,$3,$4::jsonb,$5,$2)`,
			t.RecipeID, t.DateCooked, t.Notes, t.Modifications, t.Rating)
	}
	for _, c := range ds.RecipeCollections {
		b.Queue(`INSERT INTO recipe_collections (id, user_id, name, created_at, updated_at) VALUES ($1,$2,$3,$4,$4)`,
			c.ID, userID, c.Name, c.CreatedAt)
		for i, rid := range c.RecipeIDs {
			b.Queue(`INSERT INTO recipe_collection_items (collection_id, recipe_id, added_at) VALUES ($1,$2,$3)`,
				c.ID, rid, c.CreatedAt.Add(time.Duration(i+1)*time.Minute))
		}
	}
	planCreated := ds.SeedDay.AddDate(0, 0, -2).Add(22 * time.Hour)
	b.Queue(`INSERT INTO meal_plans (id, user_id, week_start, created_at, updated_at) VALUES ($1,$2,$3::date,$4,$4)`,
		ds.MealPlanID, userID, ds.MealPlanWeek, planCreated)
	for i, e := range ds.MealPlanEntries {
		b.Queue(`INSERT INTO meal_plan_entries (meal_plan_id, recipe_id, day_of_week, meal_slot, custom_label, position, created_at) VALUES ($1,$2,$3,$4,$5,0,$6)`,
			ds.MealPlanID, e.RecipeID, e.DayOfWeek, e.Slot, nullIfEmpty(e.CustomLabel), planCreated.Add(time.Duration(i)*time.Minute))
	}
	for i, g := range ds.GroceryItems {
		source := groceryManualSource
		if g.RecipeID != nil {
			source = groceryRecipeSource(*g.RecipeID)
		}
		b.Queue(`INSERT INTO grocery_items (user_id, item, amount, recipe_id, recipe_title, source_key, name_key, checked, position, created_at, updated_at)
		         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10)`,
			userID, g.Item, g.Amount, g.RecipeID, nullIfEmpty(g.RecipeTitle), source, normalizeIngredientName(g.Item), g.Checked, i, g.CreatedAt)
	}

	for _, e := range ds.JournalEntries {
		b.Queue(`INSERT INTO journal_entries (id, user_id, title, body, mood, tags, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$7)`,
			e.ID, userID, nullIfEmpty(e.Title), e.Body, e.Mood, e.Tags, e.CreatedAt)
	}
	collCreated := ds.JournalEntries[0].CreatedAt.Add(10 * time.Minute)
	b.Queue(`INSERT INTO journal_collections (id, user_id, name, description, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$5)`,
		ds.JournalCollectionID, userID, "Training notes", "How the lifting is going, in my own words.", collCreated)
	for _, id := range ds.JournalCollected {
		b.Queue(`INSERT INTO journal_collection_entries (collection_id, entry_id, added_at)
		         SELECT $1::uuid, id, created_at + interval '1 minute' FROM journal_entries WHERE id = $2`,
			ds.JournalCollectionID, id)
	}

	for _, a := range ds.Accounts {
		b.Queue(`INSERT INTO ledger_accounts (id, user_id, name, type, currency, balance, created_at, updated_at) VALUES ($1,$2,$3,$4,'USD',$5::numeric,$6,$6)`,
			a.ID, userID, a.Name, a.Type, a.Balance, a.CreatedAt)
	}
	catCreated := ds.Accounts[0].CreatedAt
	for _, c := range ds.Categories {
		b.Queue(`INSERT INTO ledger_categories (id, user_id, name, type, color, created_at) VALUES ($1,$2,$3,$4,$5,$6)`,
			c.ID, userID, c.Name, c.Type, c.Color, catCreated)
	}
	for _, t := range ds.Transactions {
		b.Queue(`INSERT INTO ledger_transactions (user_id, account_id, category_id, type, amount, description, notes, date, is_recurring, recurrence_interval, transfer_to_account_id, created_at, updated_at)
		         VALUES ($1,$2,$3,$4,$5::numeric,$6,$7,$8::date,$9,$10,$11,$12,$12)`,
			userID, t.AccountID, t.CategoryID, t.Type, t.Amount, t.Description, nullIfEmpty(t.Notes), t.Date,
			t.Recurring != "", nullIfEmpty(t.Recurring), t.TransferTo, t.CreatedAt)
	}
	for _, bu := range ds.Budgets {
		b.Queue(`INSERT INTO ledger_budgets (user_id, category_id, amount, period, start_date, created_at, updated_at) VALUES ($1,$2,$3::numeric,'monthly',$4::date,$5,$5)`,
			userID, bu.CategoryID, bu.Amount, bu.StartDate, catCreated.Add(time.Hour))
	}
	for _, s := range ds.Snapshots {
		b.Queue(`INSERT INTO ledger_networth_snapshots (user_id, assets_total, liabilities_total, snapshot_date) VALUES ($1,$2::numeric,$3::numeric,$4::date)`,
			userID, s.Assets, s.Liabilities, s.Date)
	}
}
