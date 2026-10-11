-- Voucher numbers are drawn from a sequence rather than from a row count.
-- A count-based number races under concurrent creation and would break the
-- uniqueness rule; nextval is atomic.
CREATE SEQUENCE voucher_number_seq START 1 INCREMENT 1;
