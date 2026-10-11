-- Runs once, on first initialisation of the Postgres volume.
-- The test suite truncates tables between files, so it must never point at
-- the development database that holds the seeded demo data.
CREATE DATABASE voucher_test OWNER voucher;
