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
	r.Use(gin.Recovery())
	r.Use(middleware.CORS(cfg.CORSOrigins))

	// Services
	authService := services.NewAuthService(db, cfg)
	userService := services.NewUserService(db)
	recipeService := services.NewRecipeService(db)
	jymService := services.NewJymService(db)
	emailService := services.NewEmailService(cfg.ResendAPIKey, cfg.EmailFrom)

	// Handlers
	authHandler := handlers.NewAuthHandler(authService, userService, emailService, cfg)
	userHandler := handlers.NewUserHandler(userService)
	healthHandler := handlers.NewHealthHandler(db)
	recipeHandler := handlers.NewRecipeHandler(recipeService)
	jymHandler := handlers.NewJymHandler(jymService)

	// Rate limiter
	rl := middleware.NewRateLimiter()

	// Routes
	v1 := r.Group("/api/v1")
	{
		// Health (no auth)
		v1.GET("/health", healthHandler.Check)

		// Public profile lookup (no auth required)
		v1.GET("/profiles/:username", userHandler.GetPublicProfile)

		// Auth routes (rate limited by IP: 10/min)
		auth := v1.Group("/auth")
		auth.Use(middleware.RateLimitByIP(rl, 10))
		{
			auth.POST("/register", authHandler.Register)
			auth.POST("/login", authHandler.Login)
			auth.POST("/refresh", authHandler.Refresh)
			auth.POST("/logout", authHandler.Logout)
			auth.POST("/verify-email", authHandler.VerifyEmail)
			auth.POST("/forgot-password", authHandler.ForgotPassword)
			auth.POST("/reset-password", authHandler.ResetPassword)
		}

		// Protected routes (require JWT)
		protected := v1.Group("")
		protected.Use(middleware.AuthRequired(authService))
		{
			protected.GET("/user/me", userHandler.GetMe)
			protected.PATCH("/user/me", userHandler.UpdateMe)
			protected.POST("/auth/resend-verification", authHandler.ResendVerification)

			// Culinara (Recipe Module)
			culinara := protected.Group("/culinara")
			{
				culinara.POST("/recipes", recipeHandler.Create)
				culinara.GET("/recipes", recipeHandler.List)
				culinara.GET("/recipes/:id", recipeHandler.Get)
				culinara.PUT("/recipes/:id", recipeHandler.Update)
				culinara.DELETE("/recipes/:id", recipeHandler.Delete)
				culinara.POST("/recipes/:id/trials", recipeHandler.CreateTrial)
				culinara.PUT("/trials/:id", recipeHandler.UpdateTrial)
				culinara.DELETE("/trials/:id", recipeHandler.DeleteTrial)
				culinara.POST("/promote/:trial_id", recipeHandler.Promote)
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

				// Sessions
				jym.POST("/sessions", jymHandler.StartSession)
				jym.GET("/sessions", jymHandler.ListSessions)
				jym.GET("/sessions/:id", jymHandler.GetSession)
				jym.PATCH("/sessions/:id", jymHandler.UpdateSession)
				jym.DELETE("/sessions/:id", jymHandler.DeleteSession)

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
			}
		}
	}

	return r
}
