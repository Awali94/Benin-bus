-- =========================================================
-- BÉNIN BUS
-- DATABASE V1
-- PostgreSQL
-- =========================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =========================================================
-- USERS
-- =========================================================

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,

    phone VARCHAR(30) UNIQUE NOT NULL,
    email VARCHAR(150) UNIQUE,

    password_hash TEXT NOT NULL,

    role VARCHAR(30) NOT NULL DEFAULT 'traveler'
        CHECK (
            role IN (
                'traveler',
                'company_admin',
                'company_agent',
                'super_admin'
            )
        ),

    photo_url TEXT,

    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
        CHECK (
            status IN (
                'ACTIVE',
                'BLOCKED',
                'PENDING'
            )
        ),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- =========================================================
-- COMPANIES
-- =========================================================

CREATE TABLE IF NOT EXISTS companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    name VARCHAR(150) NOT NULL,
    phone VARCHAR(30),
    email VARCHAR(150),
    address TEXT,

    logo_url TEXT,

    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
        CHECK (
            status IN (
                'ACTIVE',
                'BLOCKED',
                'PENDING'
            )
        ),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- =========================================================
-- COMPANY USERS
-- =========================================================

CREATE TABLE IF NOT EXISTS company_users (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE
);


-- =========================================================
-- BUSES
-- =========================================================

CREATE TABLE IF NOT EXISTS buses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

    bus_number VARCHAR(50) NOT NULL,
    model VARCHAR(100),

    capacity INTEGER NOT NULL CHECK (capacity > 0),

    layout_type VARCHAR(30) DEFAULT '2x2',

    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
        CHECK (
            status IN (
                'ACTIVE',
                'INACTIVE',
                'MAINTENANCE'
            )
        ),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(company_id, bus_number)
);


-- =========================================================
-- SEATS
-- =========================================================

CREATE TABLE IF NOT EXISTS seats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    bus_id UUID NOT NULL REFERENCES buses(id) ON DELETE CASCADE,

    seat_number VARCHAR(20) NOT NULL,

    row_number INTEGER NOT NULL,
    column_number INTEGER NOT NULL,

    seat_type VARCHAR(30) DEFAULT 'NORMAL',

    status VARCHAR(20) DEFAULT 'ACTIVE'
        CHECK (
            status IN (
                'ACTIVE',
                'INACTIVE'
            )
        ),

    UNIQUE(bus_id, seat_number)
);


-- =========================================================
-- ROUTES
-- =========================================================

CREATE TABLE IF NOT EXISTS routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    departure_city VARCHAR(100) NOT NULL,
    arrival_city VARCHAR(100) NOT NULL,

    distance_km NUMERIC(10,2),

    estimated_duration INTEGER,

    status VARCHAR(20) DEFAULT 'ACTIVE'
        CHECK (
            status IN (
                'ACTIVE',
                'INACTIVE'
            )
        ),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(departure_city, arrival_city)
);


-- =========================================================
-- TRIPS
-- =========================================================

CREATE TABLE IF NOT EXISTS trips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    route_id UUID NOT NULL REFERENCES routes(id),
    bus_id UUID NOT NULL REFERENCES buses(id),

    departure_date DATE NOT NULL,
    departure_time TIME NOT NULL,
    arrival_time TIME,

    price INTEGER NOT NULL CHECK (price >= 0),

    status VARCHAR(20) DEFAULT 'SCHEDULED'
        CHECK (
            status IN (
                'SCHEDULED',
                'BOARDING',
                'DEPARTED',
                'COMPLETED',
                'CANCELLED'
            )
        ),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- =========================================================
-- RESERVATIONS
-- =========================================================

CREATE TABLE IF NOT EXISTS reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL REFERENCES users(id),

    trip_id UUID NOT NULL REFERENCES trips(id),

    reservation_number VARCHAR(50) UNIQUE NOT NULL,

    total_amount INTEGER NOT NULL CHECK (total_amount >= 0),

    status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (
            status IN (
                'PENDING',
                'CONFIRMED',
                'CANCELLED',
                'EXPIRED',
                'COMPLETED'
            )
        ),

    expires_at TIMESTAMP,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- =========================================================
-- RESERVATION SEATS
-- =========================================================

CREATE TABLE IF NOT EXISTS reservation_seats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    reservation_id UUID NOT NULL
        REFERENCES reservations(id)
        ON DELETE CASCADE,

    seat_id UUID NOT NULL
        REFERENCES seats(id),

    passenger_name VARCHAR(150) NOT NULL,

    passenger_phone VARCHAR(30),

    baggage INTEGER DEFAULT 0,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(reservation_id, seat_id)
);


-- =========================================================
-- PAYMENTS
-- =========================================================

CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    reservation_id UUID NOT NULL
        REFERENCES reservations(id)
        ON DELETE CASCADE,

    provider VARCHAR(30) NOT NULL
        CHECK (
            provider IN (
                'MTN_MOMO',
                'MOOV_MONEY',
                'CELTIIS'
            )
        ),

    amount INTEGER NOT NULL CHECK (amount >= 0),

    currency VARCHAR(10) DEFAULT 'XOF',

    transaction_reference VARCHAR(150),

    status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (
            status IN (
                'PENDING',
                'SUCCESS',
                'FAILED',
                'REFUNDED'
            )
        ),

    paid_at TIMESTAMP,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- =========================================================
-- TICKETS
-- =========================================================

CREATE TABLE IF NOT EXISTS tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    reservation_id UUID NOT NULL
        REFERENCES reservations(id)
        ON DELETE CASCADE,

    ticket_number VARCHAR(80) UNIQUE NOT NULL,

    qr_token TEXT UNIQUE NOT NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
        CHECK (
            status IN (
                'ACTIVE',
                'USED',
                'CANCELLED',
                'EXPIRED'
            )
        ),

    validated_at TIMESTAMP,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- =========================================================
-- INDEX
-- =========================================================

CREATE INDEX IF NOT EXISTS idx_trips_date
ON trips(departure_date);

CREATE INDEX IF NOT EXISTS idx_trips_route
ON trips(route_id);

CREATE INDEX IF NOT EXISTS idx_reservations_user
ON reservations(user_id);

CREATE INDEX IF NOT EXISTS idx_reservations_trip
ON reservations(trip_id);

CREATE INDEX IF NOT EXISTS idx_payments_status
ON payments(status);

CREATE INDEX IF NOT EXISTS idx_tickets_token
ON tickets(qr_token);


-- =========================================================
-- DONNÉES DE DÉMONSTRATION
-- =========================================================

INSERT INTO companies
(name, phone, email, address)
VALUES
(
    'Bénin Bus Transport',
    '0190000000',
    'contact@beninbus.com',
    'Cotonou, Bénin'
)
ON CONFLICT DO NOTHING;


INSERT INTO routes
(departure_city, arrival_city, distance_km, estimated_duration)
VALUES
('Cotonou', 'Natitingou', 650, 600),
('Natitingou', 'Cotonou', 650, 600),
('Natitingou', 'Parakou', 300, 300),
('Parakou', 'Natitingou', 300, 300)
ON CONFLICT DO NOTHING;