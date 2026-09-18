package handlers

import (
	"net/http"

	"github.com/Fejiroisaacs/Jiro-App/jiro-api/internal/models"
	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog/log"
)

// respondInternal logs the underlying error server-side and returns a fixed
// message to the client.
//
// Service-layer failures in this codebase are unwrapped pgx errors, whose text
// carries table, column and constraint names. Echoing them into an HTTP
// response hands an attacker a free map of the schema, so the detail stays in
// the log and the caller gets nothing back but the status.
//
// Binding errors are deliberately NOT routed through here: those come from the
// validator, name only the offending request field, and are genuinely useful to
// a legitimate client.
func respondInternal(c *gin.Context, err error, action string) {
	log.Error().Err(err).Msg(action)
	c.JSON(http.StatusInternalServerError, models.ErrorResponse{
		Error: models.ErrorDetail{Code: "INTERNAL_ERROR", Message: "Something went wrong"},
	})
}
