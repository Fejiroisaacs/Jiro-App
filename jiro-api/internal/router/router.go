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
	adminService := services.NewAdminService(db)

	// Handlers
	authHandler := handlers.NewAuthHandler(authService, userService, emailService, cfg, db)
	userHandler := handlers.NewUserHandler(userService)
	healthHandler := handlers.NewHealthHandler(db)
	recipeHandler := handlers.NewRecipeHandler(recipeService, db)
	jymHandler := handlers.NewJymHandler(jymService, cfg.AppBaseURL, db)
	adminHandler := handlers.NewAdminHandler(adminService, authService, userService, emailService, cfg.AppBaseURL)

	// Rate limiter
	rl := middleware.NewRateLimiter()

	// Routes
	v1 := r.Group("/api/v1")
	{
		// Health (no auth)
		v1.GET("/health", healthHandler.Check)

		// Public profile lookup (no auth required)
		v1.GET("/profiles/:username", userHandler.GetPublicProfile)

		// Public split share preview (no auth required)
		v1.GET("/jym/shares/:share_id", jymHandler.GetSharePreview)

		// Public split discovery (no auth required)
		v1.GET("/jym/public-splits", jymHandler.ListPublicSplits)
		v1.GET("/jym/public-splits/:id", jymHandler.GetPublicSplit)

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
		}

		// Admin routes (protected by X-Admin-Secret header)
		admin := v1.Group("/admin")
		admin.Use(middleware.AdminRequired(cfg.AdminSecret))
		{
			admin.GET("/stats", adminHandler.GetStats)
			admin.GET("/users", adminHandler.ListUsers)
			admin.GET("/users/:id", adminHandler.GetUser)
			admin.DELETE("/users/:id", adminHandler.DeleteUser)
			admin.POST("/users/:id/send-password-reset", adminHandler.SendPasswordReset)
			admin.POST("/users/:id/revoke-sessions", adminHandler.RevokeUserSessions)
			admin.GET("/events", adminHandler.ListEvents)
		}
	}

	return r
}
