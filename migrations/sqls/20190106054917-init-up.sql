CREATE TABLE account (
  id BIGSERIAL primary key,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  full_name TEXT
);

create table profile (
  id BIGSERIAL primary key,
  address TEXT NOT NULL,
  account_id BIGSERIAL UNIQUE REFERENCES account(id)
);

create table blog (
  id BIGSERIAL primary key,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  account_id BIGSERIAL REFERENCES account(id)
);

create table role (
  id BIGSERIAL primary key,
  name text not null
);

create table account_role (
  account_id BIGSERIAL REFERENCES account(id),
  role_id BIGSERIAL REFERENCES role(id),
  CONSTRAINT account_role_pkey PRIMARY KEY (account_id, role_id)
);
