---
kind: business_term
name: Business Glossary
category: business_term
scope:
    - '**'
---

### Gestion des Opérations Financiaire Titre 3
- Definition：The project's full domain name — a financial operations management system for French public-accounting 'Titre 3' budget lines (budget commitments, engagements, payments, beneficiaries, lots/parts, ODS). Used as the app description in package.json and Cargo.toml.
- Aliases：GOFT3、Titre 3

### PIECE
- Definition：A line-item document attached to an operation (T_PIECE) — carries beneficiary/account references, amounts, visa numbers (N_VISA_CM, N_VISA_CB), caution details, ODS reference, borderEAU number, and lot membership. It is the central entity linking operations, engagements, payments, lots, and ODS records.
- Aliases：pièce、piece

### ENGAGEMENT
- Definition：A budget commitment record (T_ENGAGEMENT) linked to an operation and piece, carrying engagement number/year, nature/object, amount, AE (autorisation d'engagement) balance, previous balances, and visa information. Multiple engagements can belong to one piece.
- Aliases：engagement

### PAIEMENT
- Definition：A payment record (T_PAIEMENT) tied to an operation, engagement, and piece, recording payment number/year/date, object, amount, total paid, mandate number/date, admission date, and various deductions (retention guarantee, penalty, advance repayment).
- Aliases：paiement

### ODS
- Definition：An 'ordre de service' (work order) record (T_ODS) referencing a piece and optionally a lot, with object/nature/date fields used to track field work authorizations.
- Aliases：ordre de service、ODS

### BORDEREAU
- Definition：A batch/transmittal cover sheet (T_BORDEREAU) identified by number and year, carrying destination, attachment list, and copy count; pieces and engagements may reference it.
- Aliases：bordereau

### LOT / LOT_PIECE
- Definition：A 'lot' (contractual lot or work package) represented by T_LOT_OPERATION plus its member items in T_LOT_PIECE; tracks initial/final amounts and attribution flag per operation.
- Aliases：lot、lot pièce

### CP
- Definition：A 'crédit de paiement' (payment credit) record (T_CP) per operation, holding initial and final credit amounts.
- Aliases：crédit de paiement、CP

### SAI_ENG / SAI_PAI
- Definition：Boolean flags on T_PIECE indicating whether the piece has been entered into the engagement system (SAI_ENG) and/or payment system (SAI_PAI); serialized as JSON booleans in the Rust command layer.
- Aliases：sai eng、sai pai

### goft3_supabase_url / goft3_supabase_key
- Definition：The two localStorage keys used to store the user-provided Supabase instance URL and anon key; presence of both validates the optional cloud configuration.
- Aliases：supabase config keys
