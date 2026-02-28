package services

import (
	"context"
	"fmt"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/google/uuid"
)

type StorageService struct {
	client    *s3.Client
	presign   *s3.PresignClient
	bucket    string
	publicURL string
}

func NewStorageService(endpoint, bucket, accessKey, secretKey, publicURL string) *StorageService {
	if endpoint == "" || accessKey == "" || secretKey == "" {
		return &StorageService{bucket: bucket, publicURL: publicURL}
	}

	creds := credentials.NewStaticCredentialsProvider(accessKey, secretKey, "")
	cfg := aws.Config{
		Region:      "auto",
		Credentials: creds,
		EndpointResolverWithOptions: aws.EndpointResolverWithOptionsFunc(
			func(service, region string, opts ...interface{}) (aws.Endpoint, error) {
				return aws.Endpoint{URL: endpoint}, nil
			},
		),
	}

	client := s3.NewFromConfig(cfg, func(o *s3.Options) {
		o.UsePathStyle = true
	})

	return &StorageService{
		client:    client,
		presign:   s3.NewPresignClient(client),
		bucket:    bucket,
		publicURL: publicURL,
	}
}

// PresignAvatarUpload returns a presigned PUT URL and the object key for an avatar upload.
// contentType must be image/jpeg, image/png, or image/webp.
// contentLength must be ≤ 5 MB.
func (s *StorageService) PresignAvatarUpload(ctx context.Context, userID uuid.UUID, ext string) (uploadURL, objectKey string, err error) {
	if s.client == nil {
		return "", "", fmt.Errorf("storage not configured")
	}

	objectKey = fmt.Sprintf("avatars/%s/%s%s", userID, uuid.New().String(), ext)

	req, err := s.presign.PresignPutObject(ctx, &s3.PutObjectInput{
		Bucket:       aws.String(s.bucket),
		Key:          aws.String(objectKey),
		CacheControl: aws.String("public, max-age=31536000, immutable"),
	}, s3.WithPresignExpires(5*time.Minute))
	if err != nil {
		return "", "", err
	}

	return req.URL, objectKey, nil
}

// PresignRecipeUpload returns a presigned PUT URL and the object key for a recipe cover image upload.
func (s *StorageService) PresignRecipeUpload(ctx context.Context, userID, recipeID uuid.UUID, ext string) (uploadURL, objectKey string, err error) {
	if s.client == nil {
		return "", "", fmt.Errorf("storage not configured")
	}

	objectKey = fmt.Sprintf("recipes/%s/%s/%s%s", userID, recipeID, uuid.New().String(), ext)

	req, err := s.presign.PresignPutObject(ctx, &s3.PutObjectInput{
		Bucket:       aws.String(s.bucket),
		Key:          aws.String(objectKey),
		CacheControl: aws.String("public, max-age=31536000, immutable"),
	}, s3.WithPresignExpires(5*time.Minute))
	if err != nil {
		return "", "", err
	}

	return req.URL, objectKey, nil
}

// PresignSessionUpload returns a presigned PUT URL and the object key for a session attachment upload.
func (s *StorageService) PresignSessionUpload(ctx context.Context, userID, sessionID uuid.UUID, ext string) (uploadURL, objectKey string, err error) {
	if s.client == nil {
		return "", "", fmt.Errorf("storage not configured")
	}

	objectKey = fmt.Sprintf("sessions/%s/%s/%s%s", userID, sessionID, uuid.New().String(), ext)

	req, err := s.presign.PresignPutObject(ctx, &s3.PutObjectInput{
		Bucket:       aws.String(s.bucket),
		Key:          aws.String(objectKey),
		CacheControl: aws.String("public, max-age=31536000, immutable"),
	}, s3.WithPresignExpires(5*time.Minute))
	if err != nil {
		return "", "", err
	}

	return req.URL, objectKey, nil
}

// PresignPutObject returns a presigned PUT URL for an arbitrary pre-built object key.
func (s *StorageService) PresignPutObject(ctx context.Context, objectKey string) (uploadURL string, key string, err error) {
	if s.client == nil {
		return "", "", fmt.Errorf("storage not configured")
	}
	req, err := s.presign.PresignPutObject(ctx, &s3.PutObjectInput{
		Bucket:       aws.String(s.bucket),
		Key:          aws.String(objectKey),
		CacheControl: aws.String("public, max-age=31536000, immutable"),
	}, s3.WithPresignExpires(5*time.Minute))
	if err != nil {
		return "", "", err
	}
	return req.URL, objectKey, nil
}

// DeleteObject removes an object from storage by key.
func (s *StorageService) DeleteObject(ctx context.Context, objectKey string) error {
	if s.client == nil {
		return nil
	}
	_, err := s.client.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(objectKey),
	})
	return err
}

// PublicURL returns the public URL for an object key.
func (s *StorageService) PublicURL(objectKey string) string {
	return fmt.Sprintf("%s/%s", s.publicURL, objectKey)
}
