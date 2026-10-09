# EdgeFinder ledger anchors

One file per day: a SHA-256 fingerprint over every verified bet ledger's latest entry.
Each ledger is listed by an opaque id. A public record page checks itself against anchors/latest.json.
Because this branch's history is public, a record's past can't be rewritten unnoticed.
