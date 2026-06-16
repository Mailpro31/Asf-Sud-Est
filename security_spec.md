# Security Specification

## Data Invariants
1. `organizations/{orgId}`: orgId must match `request.auth.uid`. Users can only create their own organization document.
2. `organizations/{orgId}` updates: Only Admins can modify `submissionStatus` or `role`. Organization can only modify their contact info.
3. `files/{fileId}`: `orgId` must match the creator's UID.
4. Admins have unrestricted access to read and update any document, but must use valid schema.

## Dirty Dozen Payloads
- Ghost Field: adding `isAdmin: true`
- Role Spoofing: setting `role: "admin"` during registration
...
