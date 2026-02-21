package services

import (
	"github.com/resend/resend-go/v2"
	"github.com/rs/zerolog/log"
)

type EmailService struct {
	client *resend.Client
	from   string
}

func NewEmailService(apiKey, from string) *EmailService {
	var client *resend.Client
	if apiKey != "" {
		client = resend.NewClient(apiKey)
	}
	return &EmailService{client: client, from: from}
}

func (s *EmailService) Send(to, subject, htmlBody string) error {
	if s.client == nil {
		log.Info().
			Str("to", to).
			Str("subject", subject).
			Str("body", htmlBody).
			Msg("[DEV] Email not sent — no RESEND_API_KEY configured")
		return nil
	}

	params := &resend.SendEmailRequest{
		From:    s.from,
		To:      []string{to},
		Subject: subject,
		Html:    htmlBody,
	}
	_, err := s.client.Emails.Send(params)
	return err
}
