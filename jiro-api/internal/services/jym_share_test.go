package services

import (
	"context"
	"testing"

	"github.com/Fejiroisaacs/Jiro-App/jiro-api/internal/models"
	"github.com/google/uuid"
)

func TestShareReusesTheLiveLinkAndListsIt(t *testing.T) {
	svc, userID := testJymDB(t)
	ctx := context.Background()
	split, err := svc.CreateSplit(ctx, userID, &models.CreateSplitRequest{Name: "Share Twice"})
	if err != nil {
		t.Fatalf("create split: %v", err)
	}
	first, err := svc.CreateShare(ctx, userID, split.ID, "https://example.com")
	if err != nil {
		t.Fatalf("share: %v", err)
	}
	second, err := svc.CreateShare(ctx, userID, split.ID, "https://example.com")
	if err != nil {
		t.Fatalf("share again: %v", err)
	}
	if first.ShareID != second.ShareID {
		t.Fatalf("sharing twice made two links: %s and %s", first.ShareID, second.ShareID)
	}
	links, err := svc.ListShares(ctx, userID, split.ID, "https://example.com")
	if err != nil || len(links) != 1 || links[0].ShareID != first.ShareID {
		t.Fatalf("list: %+v, %v", links, err)
	}
	if err := svc.RevokeShare(ctx, userID, uuid.MustParse(first.ShareID)); err != nil {
		t.Fatalf("revoke: %v", err)
	}
	if links, _ := svc.ListShares(ctx, userID, split.ID, "https://example.com"); len(links) != 0 {
		t.Fatalf("a revoked link is still listed: %+v", links)
	}
	if _, err := svc.ListShares(ctx, uuid.New(), split.ID, "https://example.com"); err != ErrSplitNotFound {
		t.Fatalf("another user's list: got %v, want ErrSplitNotFound", err)
	}
}

func TestImportingTheSameSplitTwiceOpensTheFirstCopy(t *testing.T) {
	owner, ownerID := testJymDB(t)
	_, importerID := testJymDB(t)
	ctx := context.Background()
	split, err := owner.CreateSplit(ctx, ownerID, &models.CreateSplitRequest{Name: "Borrow Me"})
	if err != nil {
		t.Fatalf("create split: %v", err)
	}
	share, err := owner.CreateShare(ctx, ownerID, split.ID, "https://example.com")
	if err != nil {
		t.Fatalf("share: %v", err)
	}
	first, err := owner.ImportShare(ctx, importerID, uuid.MustParse(share.ShareID))
	if err != nil {
		t.Fatalf("import: %v", err)
	}
	again, err := owner.ImportShare(ctx, importerID, uuid.MustParse(share.ShareID))
	if err != nil || again != first {
		t.Fatalf("import again: %v, %v; want the first copy %v", again, err, first)
	}
	// Once the copy is deleted, importing makes a fresh one.
	if err := owner.DeleteSplit(ctx, importerID, first); err != nil {
		t.Fatalf("delete copy: %v", err)
	}
	fresh, err := owner.ImportShare(ctx, importerID, uuid.MustParse(share.ShareID))
	if err != nil || fresh == first {
		t.Fatalf("import after deleting: %v, %v", fresh, err)
	}
}
