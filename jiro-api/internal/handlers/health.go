package handlers

import (
	"net/http"

	"github.com/Fejiroisaacs/Jiro-App/jiro-api/internal/database"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

type HealthHandler struct {
	db *pgxpool.Pool
}

func NewHealthHandler(db *pgxpool.Pool) *HealthHandler {
	return &HealthHandler{db: db}
}

func (h *HealthHandler) Check(c *gin.Context) {
	dbStatus := "healthy"
	if err := database.HealthCheck(h.db); err != nil {
		dbStatus = "unhealthy"
	}

	status := http.StatusOK
	if dbStatus == "unhealthy" {
		status = http.StatusServiceUnavailable
	}

	c.JSON(status, gin.H{
		"status": dbStatus,
		"services": gin.H{
			"database": dbStatus,
		},
	})
}
