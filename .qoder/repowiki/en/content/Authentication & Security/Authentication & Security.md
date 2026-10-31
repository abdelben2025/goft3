# Authentication & Security

<cite>
**Referenced Files in This Document**   
- [authUtils.ts](file://utils/authUtils.ts)
- [LoginPage.tsx](file://pages/LoginPage.tsx)
- [IdleLockScreen.tsx](file://components/IdleLockScreen.tsx)
- [types.ts](file://types.ts)
- [App.tsx](file://App.tsx)
- [DataContext.tsx](file://context/DataContext.tsx)
- [AddUserForm.tsx](file://components/forms/AddUserForm.tsx)
- [security.rs](file://src-tauri/src/security.rs)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Project Structure](#project-structure)
3. [Core Components](#core-components)
4. [Architecture Overview](#architecture-overview)
5. [Detailed Component Analysis](#detailed-component-analysis)
6. [Dependency Analysis](#dependency-analysis)
7. [Performance Considerations](#performance-considerations)
8. [Troubleshooting Guide](#troubleshooting-guide)
9. [Conclusion](#conclusion)

## Introduction
This document explains GOFT3’s authentication and security model for protecting sensitive financial data. It covers the user login and logout flow, password hashing with bcrypt-ts, session management including idle timeout protection, role-based access control, permission checking, user administration, and local data protection. The content combines conceptual overviews with technical implementation details so both security practitioners and developers can understand and extend the system safely.

## Project Structure
GOFT3 implements authentication and authorization across frontend React components, shared utilities, application routing logic, and a Tauri-backed local security layer:

- Frontend authentication UI and flows:
  - Login page handles credential verification, concurrent session checks, and automatic migration to bcrypt hashes.
  - Idle lock screen re-authenticates users after inactivity.
- Shared security utilities:
  - Password hashing and verification utilities using bcrypt-ts with legacy SHA-256 migration support.
- Role-based access control:
  - Application router enforces admin-only pages, viewer restrictions, and per-user allowed pages and operations.
- User administration:
  - User creation form hashes passwords and assigns roles and granular permissions.
- Local data protection:
  - Tauri Rust module provides AES-256-GCM encrypted backups and Windows EFS hardening for local SQLite files.

```mermaid
graph TB
subgraph "Frontend"
LoginPage["LoginPage.tsx"]
IdleLock["IdleLockScreen.tsx"]
AppRouter["App.tsx<br/>Role & Permission Checks"]
AddUserForm["AddUserForm.tsx"]
AuthUtils["authUtils.ts<br/>bcrypt-ts + Legacy Migration"]
end
subgraph "Data Layer"
DataContext["DataContext.tsx<br/>Presence, Events, DB Sync"]
Types["types.ts<br/>User, Page, OnlineUser"]
end
subgraph "Desktop Runtime"
TauriSecurity["security.rs<br/>AES-256-GCM Backups<br/>Windows EFS Hardening"]
end
LoginPage --> AuthUtils
IdleLock --> AuthUtils
AddUserForm --> AuthUtils
AppRouter --> Types
AppRouter --> DataContext
DataContext --> TauriSecurity
```

**Diagram sources**
- [LoginPage.tsx:31-146](file://pages/LoginPage.tsx#L31-L146)
- [IdleLockScreen.tsx:21-39](file://components/IdleLockScreen.tsx#L21-L39)
- [AuthUtils.ts:1-70](file://utils/authUtils.ts#L1-L70)
- [App.tsx:238-320](file://App.tsx#L238-L320)
- [DataContext.tsx:1098-1134](file://context/DataContext.tsx#L1098-L1134)
- [security.rs:1-131](file://src-tauri/src/security.rs#L1-L131)

**Section sources**
- [LoginPage.tsx:31-146](file://pages/LoginPage.tsx#L31-L146)
- [IdleLockScreen.tsx:21-39](file://components/IdleLockScreen.tsx#L21-L39)
- [authUtils.ts:1-70](file://utils/authUtils.ts#L1-L70)
- [App.tsx:238-320](file://App.tsx#L238-L320)
- [DataContext.tsx:1098-1134](file://context/DataContext.tsx#L1098-L1134)
- [security.rs:1-131](file://src-tauri/src/security.rs#L1-L131)

## Core Components
- Password hashing and verification:
  - bcrypt-ts is used for secure hashing and comparison.
  - Legacy SHA-256 hashes are supported for backward compatibility; successful legacy logins trigger automatic migration to bcrypt.
- Login flow:
  - Prevents concurrent sessions for the same username when online.
  - Verifies credentials against stored hashes (bcrypt or legacy).
  - Auto-migrates legacy hashes to bcrypt on successful login.
  - Mirrors cloud data into local SQLite after successful online login.
- Session and idle protection:
  - Idle lock screen requires password re-entry after inactivity to protect financial data.
- Role-based access control:
  - Admin-only pages and viewer page allowlists are enforced at the router level.
  - Per-user allowed pages and operations restrict navigation and record-level access.
- User administration:
  - New users are created with hashed passwords and assigned roles and optional fine-grained permissions.
- Local data protection:
  - Encrypted backups using AES-256-GCM with PBKDF2 key derivation.
  - Windows EFS encryption for local SQLite database files.

**Section sources**
- [authUtils.ts:1-70](file://utils/authUtils.ts#L1-L70)
- [LoginPage.tsx:31-146](file://pages/LoginPage.tsx#L31-L146)
- [IdleLockScreen.tsx:21-39](file://components/IdleLockScreen.tsx#L21-L39)
- [App.tsx:238-320](file://App.tsx#L238-L320)
- [AddUserForm.tsx:69-99](file://components/forms/AddUserForm.tsx#L69-L99)
- [security.rs:1-131](file://src-tauri/src/security.rs#L1-L131)

## Architecture Overview
The authentication architecture integrates browser-side React components with a Tauri runtime for local data protection. The login process validates credentials against stored hashes, manages presence and events via Supabase channels, and enforces RBAC at the application router. Idle sessions are locked and require re-authentication.

```mermaid
sequenceDiagram
participant User as "User"
participant Login as "LoginPage.tsx"
participant Utils as "authUtils.ts"
participant Data as "DataContext.tsx"
participant Tauri as "Tauri Local DB"
participant Router as "App.tsx"
User->>Login : Enter username and password
Login->>Login : Check concurrent session (online)
Login->>Utils : verifyPassword(password, storedHash)
Utils-->>Login : {valid, needsRehash}
alt Legacy hash detected
Login->>Utils : hashPassword(password)
Login->>Data : updateItem(T_USER, id, newBcryptHash)
end
alt Online login
Login->>Data : refreshData()
Data->>Tauri : mirrorDbToSqlite()
end
Login->>Router : onLogin(user)
Router->>Router : Enforce RBAC and allowed pages/operations
```

**Diagram sources**
- [LoginPage.tsx:31-146](file://pages/LoginPage.tsx#L31-L146)
- [authUtils.ts:28-70](file://utils/authUtils.ts#L28-L70)
- [DataContext.tsx:357-369](file://context/DataContext.tsx#L357-L369)
- [App.tsx:238-320](file://App.tsx#L238-L320)

## Detailed Component Analysis

### Password Hashing and Verification
GOFT3 uses bcrypt-ts for modern password hashing and supports seamless migration from legacy SHA-256 hashes. The verification function detects bcrypt hashes and compares them securely; if a legacy hash matches, it returns a flag indicating that the password should be migrated to bcrypt.

Key behaviors:
- bcrypt-ts hashing with configurable salt rounds.
- Legacy SHA-256 compatibility for existing accounts.
- Automatic migration triggered during login when legacy hashes are detected.

```mermaid
flowchart TD
Start(["verifyPassword Entry"]) --> CheckStored["Check stored hash exists"]
CheckStored --> |No| ReturnInvalid["Return valid=false, needsRehash=false"]
CheckStored --> Trim["Trim stored hash"]
Trim --> DetectBcrypt{"Is bcrypt hash?"}
DetectBcrypt --> |Yes| CompareBcrypt["compare(password, hash)"]
CompareBcrypt --> BcryptResult{"Comparison valid?"}
BcryptResult --> |Yes| ReturnValid["Return valid=true, needsRehash=false"]
BcryptResult --> |No| ReturnInvalid
DetectBcrypt --> |No| ComputeLegacy["Compute legacy SHA-256"]
ComputeLegacy --> LegacyMatch{"Matches stored legacy hash?"}
LegacyMatch --> |Yes| ReturnNeedsRehash["Return valid=true, needsRehash=true"]
LegacyMatch --> |No| ReturnInvalid
```

**Diagram sources**
- [authUtils.ts:36-70](file://utils/authUtils.ts#L36-L70)

**Section sources**
- [authUtils.ts:1-70](file://utils/authUtils.ts#L1-L70)

### Login Flow and Concurrent Session Protection
The login page performs several security checks before granting access:
- Blocks concurrent sessions for the same username when online.
- Prefers local SQLite credentials in offline desktop mode.
- Falls back to in-memory users and triggers a full refresh if needed.
- Verifies passwords using the utility functions.
- Migrates legacy hashes to bcrypt automatically.
- Mirrors cloud data into local SQLite after successful online login.

```mermaid
sequenceDiagram
participant User as "User"
participant Login as "LoginPage.tsx"
participant Data as "DataContext.tsx"
participant Utils as "authUtils.ts"
User->>Login : Submit credentials
Login->>Login : Normalize username
Login->>Login : Check online concurrent session
alt Offline desktop mode
Login->>Login : Load local SQLite user
else Fallback
Login->>Login : Search in-memory users
end
Login->>Utils : verifyPassword(password, storedHash)
alt needsRehash
Login->>Utils : hashPassword(password)
Login->>Data : updateItem(T_USER, id, newHash)
end
alt Online
Login->>Data : refreshData()
end
Login-->>User : Navigate to app
```

**Diagram sources**
- [LoginPage.tsx:31-146](file://pages/LoginPage.tsx#L31-L146)
- [authUtils.ts:36-70](file://utils/authUtils.ts#L36-L70)
- [DataContext.tsx:357-369](file://context/DataContext.tsx#L357-L369)

**Section sources**
- [LoginPage.tsx:31-146](file://pages/LoginPage.tsx#L31-L146)

### Idle Lock Screen and Session Timeout Protection
The idle lock screen protects sensitive financial data by requiring password re-entry after inactivity. It verifies the current user’s password using the same hashing utilities and prevents unauthorized access until unlocked.

Key behaviors:
- Focuses input automatically.
- Disables submit while verifying.
- Uses verifyPassword to validate the unlock attempt.
- Displays localized error messages.

```mermaid
flowchart TD
UnlockStart["Idle Lock Screen Submit"] --> ValidateInput["Validate password not empty"]
ValidateInput --> Verify["verifyPassword(password, user.PASSWORD)"]
Verify --> Valid{"Password valid?"}
Valid --> |Yes| ClearAndUnlock["Clear password and call onUnlock()"]
Valid --> |No| ShowError["Show error message"]
```

**Diagram sources**
- [IdleLockScreen.tsx:21-39](file://components/IdleLockScreen.tsx#L21-L39)
- [authUtils.ts:36-70](file://utils/authUtils.ts#L36-L70)

**Section sources**
- [IdleLockScreen.tsx:1-81](file://components/IdleLockScreen.tsx#L1-L81)

### Role-Based Access Control and Permission Checking
GOFT3 enforces RBAC at the application router:
- Admin-only pages are restricted to users with ROLE 'admin'.
- Viewer users have a predefined allowlist of pages.
- Non-admin users can have custom ALLOWED_PAGES restricting navigation.
- Record-level access control checks ALLOWED_OPERATIONS for operation-specific pages.

```mermaid
flowchart TD
Route["App Router"] --> Roles["Determine isAdmin/isViewer"]
Roles --> AdminPages{"Admin-only page?"}
AdminPages --> |Yes| CheckAdmin{"isAdmin?"}
CheckAdmin --> |No| RedirectHome["Redirect to HOME"]
CheckAdmin --> |Yes| RenderPage["Render Page"]
AdminPages --> |No| ViewerCheck{"isViewer?"}
ViewerCheck --> |Yes| ViewerAllow{"Page in viewer allowlist?"}
ViewerAllow --> |No| RedirectHome
ViewerAllow --> |Yes| CustomPages{"ALLOWED_PAGES set?"}
ViewerCheck --> |No| CustomPages
CustomPages --> |Yes| AllowedPages{"currentPage in ALLOWED_PAGES?"}
AllowedPages --> |No| RedirectHome
AllowedPages --> |Yes| RecordCheck{"OPERATION_DETAILS selected?"}
RecordCheck --> |Yes| AllowedOps{"selectedOperationId in ALLOWED_OPERATIONS?"}
AllowedOps --> |No| RedirectHome
RecordCheck --> |No| RenderPage
```

**Diagram sources**
- [App.tsx:238-320](file://App.tsx#L238-L320)

**Section sources**
- [App.tsx:238-320](file://App.tsx#L238-L320)

### User Administration and Role Assignment
The user creation form supports:
- Creating users with hashed passwords.
- Assigning roles ('admin', 'user', 'viewer').
- Setting per-user allowed pages and operations for non-admin users.
- Preserving existing passwords when editing without changes.

```mermaid
flowchart TD
FormSubmit["AddUserForm Submit"] --> ValidateFields["Validate username and password"]
ValidateFields --> HashCheck{"New user or changed password?"}
HashCheck --> |Yes| HashPassword["hashPassword(password)"]
HashCheck --> |No| UseExisting["Use existing PASSWORD"]
HashPassword --> SaveUser["Save user with ROLE and ALLOWED_* fields"]
UseExisting --> SaveUser
```

**Diagram sources**
- [AddUserForm.tsx:69-99](file://components/forms/AddUserForm.tsx#L69-L99)
- [authUtils.ts:28-30](file://utils/authUtils.ts#L28-L30)

**Section sources**
- [AddUserForm.tsx:35-99](file://components/forms/AddUserForm.tsx#L35-L99)

### Local Data Protection and Backup Encryption
GOFT3’s Tauri security module provides:
- AES-256-GCM encryption for backups with PBKDF2-HMAC-SHA256 key derivation.
- Detection of encrypted vs. plain backups.
- Windows EFS encryption for local SQLite database files.

```mermaid
flowchart TD
Backup["Backup Payload"] --> DeriveKey["PBKDF2 derive_key(passphrase, salt)"]
DeriveKey --> Encrypt["AES-256-GCM encrypt(salt, nonce, payload)"]
Encrypt --> Header["Prepend magic || salt || nonce"]
Header --> Output["Encrypted Backup File"]
Decrypt["Encrypted Backup"] --> CheckMagic{"Magic header present?"}
CheckMagic --> |No| ErrorNotEncrypted["Error: NOT_ENCRYPTED"]
CheckMagic --> |Yes| Extract["Extract salt, nonce, ciphertext"]
Extract --> DeriveKey2["PBKDF2 derive_key(passphrase, salt)"]
DeriveKey2 --> DecryptGCM["AES-256-GCM decrypt(nonce, ciphertext)"]
DecryptGCM --> Success["Plain Backup Payload"]
```

**Diagram sources**
- [security.rs:23-64](file://src-tauri/src/security.rs#L23-L64)

**Section sources**
- [security.rs:1-131](file://src-tauri/src/security.rs#L1-L131)

## Dependency Analysis
Authentication and security dependencies span frontend utilities, React components, application context, and Tauri runtime:

```mermaid
graph LR
AuthUtils["utils/authUtils.ts"] --> LoginPage["pages/LoginPage.tsx"]
AuthUtils --> IdleLock["components/IdleLockScreen.tsx"]
AuthUtils --> AddUserForm["components/forms/AddUserForm.tsx"]
Types["types.ts"] --> AppRouter["App.tsx"]
DataContext["context/DataContext.tsx"] --> AppRouter
DataContext --> TauriSecurity["src-tauri/src/security.rs"]
```

**Diagram sources**
- [authUtils.ts:1-70](file://utils/authUtils.ts#L1-L70)
- [LoginPage.tsx:31-146](file://pages/LoginPage.tsx#L31-L146)
- [IdleLockScreen.tsx:21-39](file://components/IdleLockScreen.tsx#L21-L39)
- [AddUserForm.tsx:69-99](file://components/forms/AddUserForm.tsx#L69-L99)
- [types.ts:9-16](file://types.ts#L9-L16)
- [App.tsx:238-320](file://App.tsx#L238-L320)
- [DataContext.tsx:1098-1134](file://context/DataContext.tsx#L1098-L1134)
- [security.rs:1-131](file://src-tauri/src/security.rs#L1-L131)

**Section sources**
- [authUtils.ts:1-70](file://utils/authUtils.ts#L1-L70)
- [LoginPage.tsx:31-146](file://pages/LoginPage.tsx#L31-L146)
- [IdleLockScreen.tsx:21-39](file://components/IdleLockScreen.tsx#L21-L39)
- [AddUserForm.tsx:69-99](file://components/forms/AddUserForm.tsx#L69-L99)
- [types.ts:9-16](file://types.ts#L9-L16)
- [App.tsx:238-320](file://App.tsx#L238-L320)
- [DataContext.tsx:1098-1134](file://context/DataContext.tsx#L1098-L1134)
- [security.rs:1-131](file://src-tauri/src/security.rs#L1-L131)

## Performance Considerations
- Password hashing:
  - bcrypt-ts hashing cost is controlled by salt rounds; ensure environment performance allows timely login UX.
- Legacy migration:
  - Automatic bcrypt migration occurs on login; consider background processing to avoid blocking UI.
- Presence and events:
  - Presence tracking and event broadcasting use Supabase channels; network latency may affect real-time features.
- Local SQLite mirroring:
  - Post-login mirroring runs in background; failures are logged but do not block login.

[No sources needed since this section provides general guidance]

## Troubleshooting Guide
Common issues and mitigations:
- Concurrent session blocked:
  - If a username is already online, login is refused; instruct the user to log out from the other device.
- Legacy password mismatch:
  - Ensure legacy SHA-256 hashes exist only for migrated accounts; otherwise, reset or migrate passwords.
- Idle lock errors:
  - Verify that the stored hash is accessible and that verifyPassword handles errors gracefully.
- RBAC redirections:
  - Confirm that ALLOWED_PAGES and ALLOWED_OPERATIONS are correctly set for non-admin users.
- Local backup decryption:
  - Ensure passphrase correctness; wrong passphrases return specific errors.

**Section sources**
- [LoginPage.tsx:51-57](file://pages/LoginPage.tsx#L51-L57)
- [authUtils.ts:36-70](file://utils/authUtils.ts#L36-L70)
- [IdleLockScreen.tsx:21-39](file://components/IdleLockScreen.tsx#L21-L39)
- [App.tsx:277-320](file://App.tsx#L277-L320)
- [security.rs:51-64](file://src-tauri/src/security.rs#L51-L64)

## Conclusion
GOFT3 implements a robust authentication and security model tailored for financial data protection. It combines modern password hashing with legacy migration, concurrent session controls, idle session locking, comprehensive RBAC, and strong local data encryption. Administrators can create users, assign roles, and enforce granular permissions, while the system maintains auditability through presence and event channels. Following the documented best practices ensures secure deployment and ongoing compliance.

[No sources needed since this section summarizes without analyzing specific files]