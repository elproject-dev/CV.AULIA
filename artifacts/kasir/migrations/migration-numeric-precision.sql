-- Tingkatkan batas maksimal kolom angka menjadi 18 digit (numeric 20,2) untuk mencegah error numeric field overflow
ALTER TABLE expenses ALTER COLUMN amount TYPE numeric(20, 2);

ALTER TABLE transactions ALTER COLUMN subtotal TYPE numeric(20, 2);
ALTER TABLE transactions ALTER COLUMN tax TYPE numeric(20, 2);
ALTER TABLE transactions ALTER COLUMN discount TYPE numeric(20, 2);

ALTER TABLE transaction_items ALTER COLUMN price TYPE numeric(20, 2);
ALTER TABLE transaction_items ALTER COLUMN subtotal TYPE numeric(20, 2);

ALTER TABLE products ALTER COLUMN price TYPE numeric(20, 2);
