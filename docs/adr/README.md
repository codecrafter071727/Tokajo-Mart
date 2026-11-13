# Architecture decision records

Short records of decisions that differ from, or sharpen, ARCHITECTURE.md. Each has the context,
the decision and its consequences. Add a new numbered file for a new decision; never rewrite an
accepted one, supersede it.

| ADR                                                 | Decision                                             |
| --------------------------------------------------- | ---------------------------------------------------- |
| [0001](0001-http-between-services.md)               | services call each other over HTTP, not Pub/Sub      |
| [0002](0002-own-identity-service.md)                | our own identity service and JWTs, not Supabase Auth |
| [0003](0003-polling-instead-of-realtime.md)         | apps poll instead of Supabase Realtime               |
| [0004](0004-money-in-integer-paise.md)              | all money is integer paise                           |
| [0005](0005-stock-reservation-model.md)             | hold, sell, release and restock stock                |
| [0006](0006-idempotency-keys.md)                    | idempotency keys on order and refund creation        |
| [0007](0007-codes-checked-on-the-server.md)         | handover and delivery codes checked by the server    |
| [0008](0008-local-postgres-only-for-development.md) | local Postgres for development, never the hosted DB  |
| [0009](0009-booking-hub-design-system-for-admin.md) | admin web uses the Booking Hub design system         |
| [0010](0010-dark-text-on-brand-green.md)            | dark text on the brand green                         |
