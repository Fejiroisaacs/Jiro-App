package handlers

import (
	"net/http"

	"github.com/Fejiroisaacs/Jiro-App/jiro-api/internal/models"
	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog/log"
)

// respondInternal logs the error and returns a fixed message. Service errors here
// are raw pgx errors carrying table and constraint names. Binding errors are not
// routed through this — those name a request field and are useful to the caller.
func respondInternal(c *gin.Context, err error, action string) {
	log.Error().Err(err).Msg(action)
	c.JSON(http.StatusInternalServerError, models.ErrorResponse{
		Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Something went wrong"},
	})
}
