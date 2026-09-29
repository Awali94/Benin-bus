// =========================================================
// BÉNIN BUS
// BACKEND V1
// Node.js + Express + PostgreSQL
// =========================================================

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const path = require("path");
const { Pool } = require("pg");

const app = express();

// =========================================================
// CONFIGURATION
// =========================================================

const PORT = process.env.PORT || 10000;

const JWT_SECRET =
    process.env.JWT_SECRET || "CHANGE-MOI-SECRET-BENIN-BUS";

// =========================================================
// MIDDLEWARE
// =========================================================

app.use(cors({ origin: "*" }));

app.use(express.json());

app.use(express.urlencoded({ extended: true }));

// =========================================================
// FRONTEND BÉNIN BUS
// =========================================================

// Le fichier HTML doit être :
// public/index.html

app.use(express.static(path.join(__dirname, "public")));

// =========================================================
// DATABASE
// =========================================================

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,

    ssl:
        process.env.NODE_ENV === "production"
          ? { rejectUnauthorized: false }
            : false
});

// =========================================================
// OUTILS
// =========================================================

function generateReservationNumber() {
    const random =
        Math.floor(100000 + Math.random() * 900000);

    return "BB-" + Date.now() + "-" + random;
}

function generateTicketNumber() {
    const random =
        Math.floor(100000 + Math.random() * 900000);

    return "TKT-" + Date.now() + "-" + random;
}

function generateQRToken() {
    return crypto.randomBytes(32).toString("hex");
}

// =========================================================
// AUTHENTIFICATION JWT
// =========================================================

function createToken(user) {
    return jwt.sign(
        {
            id: user.id,
            role: user.role
        },
        JWT_SECRET,
        {
            expiresIn: "7d"
        }
    );
}

function authRequired(req, res, next) {
    try {
        const header = req.headers.authorization;

        if (!header) {
            return res.status(401).json({
                success: false,
                message: "Token manquant"
            });
        }

        const token = header.replace("Bearer ", "");

        const decoded = jwt.verify(
            token,
            JWT_SECRET
        );

        req.user = decoded;

        next();

    } catch (error) {

        return res.status(401).json({
            success: false,
            message: "Token invalide ou expiré"
        });
    }
}

function roleRequired(...roles) {

    return (req, res, next) => {

        if (!roles.includes(req.user.role)) {

            return res.status(403).json({
                success: false,
                message: "Accès refusé"
            });
        }

        next();
    };
}

// =========================================================
// PAGE PRINCIPALE
// =========================================================

// Quand quelqu'un ouvre ton lien Render,
// Express affiche ton interface Bénin Bus.

app.get("/", (req, res) => {

    res.sendFile(
        path.join(
            __dirname,
            "public",
            "index.html"
        )
    );
});

// =========================================================
// TEST API
// =========================================================

app.get("/api/health", async (req, res) => {

    try {

        await pool.query("SELECT 1");

        res.json({
            success: true,
            database: "connected",
            status: "online",
            project: "Bénin Bus",
            version: "1.0.0"
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            database: "error",
            status: "offline",
            message: error.message
        });
    }
});// =========================================================
// INSCRIPTION
// =========================================================

app.post("/api/auth/register", async (req, res) => {

    try {

        const {
            first_name,
            last_name,
            phone,
            email,
            password
        } = req.body;

        if (
          !first_name ||
          !last_name ||
          !phone ||
          !password
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Prénom, nom, téléphone et mot de passe sont obligatoires"
            });
        }

        const existing =
            await pool.query(
                `
                SELECT id
                FROM users
                WHERE phone = $1
                `,
                [phone]
            );

        if (existing.rows.length > 0) {

            return res.status(409).json({
                success: false,
                message:
                    "Ce numéro de téléphone est déjà utilisé"
            });
        }

        const passwordHash =
            await bcrypt.hash(password, 12);

        const result =
            await pool.query(
                `
                INSERT INTO users
                (
                    first_name,
                    last_name,
                    phone,
                    email,
                    password_hash,
                    role
                )
                VALUES
                (
                    $1,
                    $2,
                    $3,
                    $4,
                    $5,
                    'traveler'
                )
                RETURNING
                    id,
                    first_name,
                    last_name,
                    phone,
                    email,
                    role,
                    status,
                    created_at
                `,
                [
                    first_name,
                    last_name,
                    phone,
                    email || null,
                    passwordHash
                ]
            );

        const user = result.rows[0];

        const token = createToken(user);

        res.status(201).json({
            success: true,
            message: "Compte créé avec succès",
            token,
            user
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: "Erreur serveur"
        });
    }
});

// =========================================================
// CONNEXION
// =========================================================

app.post("/api/auth/login", async (req, res) => {

    try {

        const {
            phone,
            password
        } = req.body;

        if (!phone ||!password) {

            return res.status(400).json({
                success: false,
                message:
                    "Téléphone et mot de passe obligatoires"
            });
        }

        const result =
            await pool.query(
                `
                SELECT *
                FROM users
                WHERE phone = $1
                `,
                [phone]
            );

        if (result.rows.length === 0) {

            return res.status(401).json({
                success: false,
                message:
                    "Téléphone ou mot de passe incorrect"
            });
        }

        const user = result.rows[0];

        const valid =
            await bcrypt.compare(
                password,
                user.password_hash
            );

        if (!valid) {

            return res.status(401).json({
                success: false,
                message:
                    "Téléphone ou mot de passe incorrect"
            });
        }

        if (user.status!== "ACTIVE") {

            return res.status(403).json({
                success: false,
                message:
                    "Votre compte est bloqué ou inactif"
            });
        }

        const token = createToken(user);

        delete user.password_hash;

        res.json({
            success: true,
            message: "Connexion réussie",
            token,
            user
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: "Erreur serveur"
        });
    }
});

// =========================================================
// PROFIL UTILISATEUR
// =========================================================

app.get(
    "/api/auth/me",
    authRequired,
    async (req, res) => {

        try {

            const result =
                await pool.query(
                    `
                    SELECT
                        id,
                        first_name,
                        last_name,
                        phone,
                        email,
                        role,
                        photo_url,
                        status,
                        created_at
                    FROM users
                    WHERE id = $1
                    `,
                    [req.user.id]
                );

            if (result.rows.length === 0) {

                return res.status(404).json({
                    success: false,
                    message: "Utilisateur introuvable"
                });
            }

            res.json({
                success: true,
                user: result.rows[0]
            });

        } catch (error) {

            console.error(error);

            res.status(500).json({
                success: false,
                message: "Erreur serveur"
            });
        }
    }
);

// =========================================================
// ROUTES
// =========================================================

app.get("/api/routes", async (req, res) => {

    try {

        const result =
            await pool.query(
                `
                SELECT *
                FROM routes
                WHERE status = 'ACTIVE'
                ORDER BY departure_city, arrival_city
                `
            );

        res.json({
            success: true,
            routes: result.rows
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: "Erreur serveur"
        });
    }
});// =========================================================
// LISTE DES TRAJETS
// =========================================================

app.get("/api/trips", async (req, res) => {

    try {

        const {
            departure,
            arrival,
            date
        } = req.query;

        let query = `
            SELECT
                t.id,
                t.departure_date,
                t.departure_time,
                t.arrival_time,
                t.price,
                t.status,

                r.departure_city,
                r.arrival_city,

                b.id AS bus_id,
                b.bus_number,
                b.model,
                b.capacity,

                c.id AS company_id,
                c.name AS company_name

            FROM trips t

            JOIN routes r
                ON r.id = t.route_id

            JOIN buses b
                ON b.id = t.bus_id

            JOIN companies c
                ON c.id = b.company_id

            WHERE t.status = 'SCHEDULED'
        `;

        const values = [];

        let index = 1;

        if (departure) {

            query += `
                AND LOWER(r.departure_city)
                = LOWER($${index})
            `;

            values.push(departure);

            index++;
        }

        if (arrival) {

            query += `
                AND LOWER(r.arrival_city)
                = LOWER($${index})
            `;

            values.push(arrival);

            index++;
        }

        if (date) {

            query += `
                AND t.departure_date = $${index}
            `;

            values.push(date);

            index++;
        }

        query += `
            ORDER BY
                t.departure_date,
                t.departure_time
        `;

        const result =
            await pool.query(
                query,
                values
            );

        res.json({
            success: true,
            trips: result.rows
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: "Erreur serveur"
        });
    }
});

// =========================================================
// SIÈGES D'UN TRAJET
// =========================================================

app.get(
    "/api/trips/:id/seats",
    async (req, res) => {

        try {

            const tripId =
                req.params.id;

            const result =
                await pool.query(
                    `
                    SELECT
                        s.id,
                        s.seat_number,
                        s.row_number,
                        s.column_number,
                        s.seat_type,

                        CASE
                            WHEN EXISTS (
                                SELECT 1
                                FROM reservation_seats rs

                                JOIN reservations r
                                    ON r.id =
                                    rs.reservation_id

                                WHERE
                                    rs.seat_id = s.id

                                    AND r.trip_id = $1

                                    AND r.status IN
                                    ('PENDING','CONFIRMED')

                                    AND (
                                        r.status <> 'PENDING'
                                        OR r.expires_at > NOW()
                                    )
                            )

                            THEN false
                            ELSE true

                        END AS available

                    FROM seats s

                    JOIN trips t
                        ON t.bus_id = s.bus_id

                    WHERE t.id = $1

                    ORDER BY
                        s.row_number,
                        s.column_number
                    `,
                    [tripId]
                );

            res.json({
                success: true,
                trip_id: tripId,
                seats: result.rows
            });

        } catch (error) {

            console.error(error);

            res.status(500).json({
                success: false,
                message: "Erreur serveur"
            });
        }
    }
);

// =========================================================
// CRÉATION RÉSERVATION
// =========================================================

app.post(
    "/api/reservations",
    authRequired,
    async (req, res) => {

        const client =
            await pool.connect();

        try {

            const {
                trip_id,
                seat_ids,
                passenger_name,
                passenger_phone,
                baggage
            } = req.body;

            if (
              !trip_id ||
              !Array.isArray(seat_ids) ||
                seat_ids.length === 0 ||
              !passenger_name
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Trajet, siège(s) et nom du passager obligatoires"
                });
            }

            await client.query("BEGIN");

            // -------------------------------------------------
            // Vérifier le trajet
            // -------------------------------------------------

            const tripResult =
                await client.query(
                    `
                    SELECT *
                    FROM trips
                    WHERE id = $1
                    AND status = 'SCHEDULED'
                    FOR UPDATE
                    `,
                    [trip_id]
                );

            if (tripResult.rows.length === 0) {

                throw new Error(
                    "Trajet introuvable ou indisponible"
                );
            }

            const trip =
                tripResult.rows[0];

            // -------------------------------------------------
            // Vérifier les sièges
            // -------------------------------------------------

            const seatsResult =
                await client.query(
                    `
                    SELECT *
                    FROM seats
                    WHERE id = ANY($1::uuid[])
                    FOR UPDATE
                    `,
                    [seat_ids]
                );

            if (
                seatsResult.rows.length!==
                seat_ids.length
            ) {

                throw new Error(
                    "Un ou plusieurs sièges sont invalides"
                );
            }            // -------------------------------------------------
            // Vérifier les sièges occupés
            // -------------------------------------------------

            const occupiedResult =
                await client.query(
                    `
                    SELECT rs.seat_id

                    FROM reservation_seats rs

                    JOIN reservations r
                        ON r.id =
                        rs.reservation_id

                    WHERE
                        r.trip_id = $1

                        AND rs.seat_id =
                        ANY($2::uuid[])

                        AND r.status IN
                        ('PENDING','CONFIRMED')

                        AND (
                            r.status = 'CONFIRMED'
                            OR r.expires_at > NOW()
                        )

                    FOR UPDATE
                    `,
                    [
                        trip_id,
                        seat_ids
                    ]
                );

            if (
                occupiedResult.rows.length > 0
            ) {

                throw new Error(
                    "Un ou plusieurs sièges viennent d'être réservés"
                );
            }

            // -------------------------------------------------
            // Calcul
            // -------------------------------------------------

            const totalAmount =
                Number(trip.price) *
                seat_ids.length;

            const reservationNumber =
                generateReservationNumber();

            // -------------------------------------------------
            // Réservation temporaire
            // -------------------------------------------------

            const reservationResult =
                await client.query(
                    `
                    INSERT INTO reservations
                    (
                        user_id,
                        trip_id,
                        reservation_number,
                        total_amount,
                        status,
                        expires_at
                    )

                    VALUES
                    (
                        $1,
                        $2,
                        $3,
                        $4,
                        'PENDING',
                        NOW() + INTERVAL '10 minutes'
                    )

                    RETURNING *
                    `,
                    [
                        req.user.id,
                        trip_id,
                        reservationNumber,
                        totalAmount
                    ]
                );

            const reservation =
                reservationResult.rows[0];

            // -------------------------------------------------
            // Ajouter les sièges
            // -------------------------------------------------

            for (const seatId of seat_ids) {

                await client.query(
                    `
                    INSERT INTO reservation_seats
                    (
                        reservation_id,
                        seat_id,
                        passenger_name,
                        passenger_phone,
                        baggage
                    )

                    VALUES
                    (
                        $1,
                        $2,
                        $3,
                        $4,
                        $5
                    )
                    `,
                    [
                        reservation.id,
                        seatId,
                        passenger_name,
                        passenger_phone || null,
                        baggage || 0
                    ]
                );
            }

            await client.query("COMMIT");

            res.status(201).json({
                success: true,
                message:
                    "Siège(s) temporairement réservé(s)",
                reservation
            });

        } catch (error) {

            await client.query("ROLLBACK");

            console.error(error);

            res.status(409).json({
                success: false,
                message: error.message
            });

        } finally {

            client.release();
        }
    }
);

// =========================================================
// MES RÉSERVATIONS
// =========================================================

app.get(
    "/api/reservations/my",
    authRequired,
    async (req, res) => {

        try {

            const result =
                await pool.query(
                    `
                    SELECT
                        r.id,
                        r.reservation_number,
                        r.total_amount,
                        r.status,
                        r.expires_at,
                        r.created_at,

                        t.departure_date,
                        t.departure_time,
                        t.price,

                        ro.departure_city,
                        ro.arrival_city,

                        b.bus_number,

                        COALESCE(
                            JSON_AGG(
                                JSON_BUILD_OBJECT(
                                    'seat_id',
                                    s.id,

                                    'seat_number',
                                    s.seat_number,

                                    'passenger_name',
                                    rs.passenger_name
                                )
                            )
                            FILTER (
                                WHERE s.id IS NOT NULL
                            ),
                            '[]'
                        ) AS seats

                    FROM reservations r

                    JOIN trips t
                        ON t.id = r.trip_id

                    JOIN routes ro
                        ON ro.id = t.route_id

                    JOIN buses b
                        ON b.id = t.bus_id

                    LEFT JOIN reservation_seats rs
                        ON rs.reservation_id = r.id

                    LEFT JOIN seats s
                        ON s.id = rs.seat_id

                    WHERE r.user_id = $1

                    GROUP BY
                        r.id,
                        t.id,
                        ro.id,
                        b.id

                    ORDER BY
                        r.created_at DESC
                    `,
                    [req.user.id]
                );

            res.json({
                success: true,
                reservations: result.rows
            });

        } catch (error) {

            console.error(error);

            res.status(500).json({
                success: false,
                message: "Erreur serveur"
            });
        }
    }
);

// =========================================================
// ANNULER UNE RÉSERVATION
// =========================================================

app.post(
    "/api/reservations/:id/cancel",
    authRequired,
    async (req, res) => {

        try {

            const result =
                await pool.query(
                    `
                    UPDATE reservations

                    SET
                        status = 'CANCELLED',
                        updated_at = NOW()

                    WHERE id = $1

                    AND user_id = $2

                    AND status IN
                    ('PENDING','CONFIRMED')

                    RETURNING *
                    `,
                    [
                        req.params.id,
                        req.user.id
                    ]
                );

            if (result.rows.length === 0) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Réservation introuvable ou non annulable"
                });
            }

            res.json({
                success: true,
                message:
                    "Réservation annulée",
                reservation:
                    result.rows[0]
            });

        } catch (error) {

            console.error(error);

            res.status(500).json({
                success: false,
                message: "Erreur serveur"
            });
        }
    }
);// =========================================================
// PAIEMENT
// =========================================================

app.post(
    "/api/payments",
    authRequired,
    async (req, res) => {

        try {

            const {
                reservation_id,
                provider
            } = req.body;

            const allowedProviders = [
                "MTN_MOMO",
                "MOOV_MONEY",
                "CELTIIS"
            ];

            if (
              !allowedProviders.includes(
                    provider
                )
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Méthode de paiement invalide"
                });
            }

            const reservationResult =
                await pool.query(
                    `
                    SELECT *
                    FROM reservations
                    WHERE id = $1
                    AND user_id = $2
                    `,
                    [
                        reservation_id,
                        req.user.id
                    ]
                );

            if (
                reservationResult.rows.length === 0
            ) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Réservation introuvable"
                });
            }

            const reservation =
                reservationResult.rows[0];

            if (
                reservation.status!== "PENDING"
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Cette réservation n'est plus en attente"
                });
            }

            const result =
                await pool.query(
                    `
                    INSERT INTO payments
                    (
                        reservation_id,
                        provider,
                        amount,
                        currency,
                        status
                    )

                    VALUES
                    (
                        $1,
                        $2,
                        $3,
                        'XOF',
                        'PENDING'
                    )

                    RETURNING *
                    `,
                    [
                        reservation.id,
                        provider,
                        reservation.total_amount
                    ]
                );

            res.status(201).json({
                success: true,
                message:
                    "Paiement créé. En attente du fournisseur.",
                payment:
                    result.rows[0]
            });

        } catch (error) {

            console.error(error);

            res.status(500).json({
                success: false,
                message: "Erreur serveur"
            });
        }
    }
);

// =========================================================
// CONFIRMATION PAIEMENT - MODE DÉMO
// =========================================================

app.post(
    "/api/payments/:id/demo-success",
    authRequired,
    async (req, res) => {

        const client =
            await pool.connect();

        try {

            await client.query("BEGIN");

            const paymentResult =
                await client.query(
                    `
                    SELECT
                        p.*,
                        r.user_id,
                        r.status AS reservation_status

                    FROM payments p

                    JOIN reservations r
                        ON r.id =
                        p.reservation_id

                    WHERE p.id = $1

                    AND r.user_id = $2

                    FOR UPDATE
                    `,
                    [
                        req.params.id,
                        req.user.id
                    ]
                );

            if (
                paymentResult.rows.length === 0
            ) {

                throw new Error(
                    "Paiement introuvable"
                );
            }

            const payment =
                paymentResult.rows[0];

            await client.query(
                `
                UPDATE payments

                SET
                    status = 'SUCCESS',
                    transaction_reference = $1,
                    paid_at = NOW()

                WHERE id = $2
                `,
                [
                    "DEMO-" + Date.now(),
                    payment.id
                ]
            );

            const reservationResult =
                await client.query(
                    `
                    UPDATE reservations

                    SET
                        status = 'CONFIRMED',
                        updated_at = NOW()

                    WHERE id = $1

                    RETURNING *
                    `,
                    [
                        payment.reservation_id
                    ]
                );

            const reservation =
                reservationResult.rows[0];

            // -------------------------------------------------
            // Générer le ticket
            // -------------------------------------------------

            const ticketNumber =
                generateTicketNumber();

            const qrToken =
                generateQRToken();

            const ticketResult =
                await client.query(
                    `
                    INSERT INTO tickets
                    (
                        reservation_id,
                        ticket_number,
                        qr_token,
                        status
                    )

                    VALUES
                    (
                        $1,
                        $2,
                        $3,
                        'ACTIVE'
                    )

                    RETURNING *
                    `,
                    [
                        reservation.id,
                        ticketNumber,
                        qrToken
                    ]
                );

            await client.query("COMMIT");

            res.json({
                success: true,
                message:
                    "Paiement confirmé",
                reservation,
                ticket:
                    ticketResult.rows[0]
            });

        } catch (error) {

            await client.query("ROLLBACK");

            console.error(error);

            res.status(400).json({
                success: false,
                message: error.message
            });

        } finally {

            client.release();
        }
    }
);

// =========================================================
// TICKET
// =========================================================

app.get(
    "/api/tickets/:id",
    authRequired,
    async (req, res) => {

        try {

            const result =
                await pool.query(
                    `
                    SELECT
                        tk.*,

                        r.reservation_number,
                        r.total_amount,
                        r.status AS reservation_status,

                        t.departure_date,
                        t.departure_time,

                        ro.departure_city,
                        ro.arrival_city,

                        b.bus_number

                    FROM tickets tk

                    JOIN reservations r
                        ON r.id =
                        tk.reservation_id

                    JOIN trips t
                        ON t.id = r.trip_id

                    JOIN routes ro
                        ON ro.id = t.route_id

                    JOIN buses b
                        ON b.id = t.bus_id

                    WHERE tk.id = $1

                    AND r.user_id = $2
                    `,
                    [
                        req.params.id,
                        req.user.id
                    ]
                );

            if (result.rows.length === 0) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Ticket introuvable"
                });
            }

            res.json({
                success: true,
                ticket:
                    result.rows[0]
            });

        } catch (error) {

            console.error(error);

            res.status(500).json({
                success: false,
                message: "Erreur serveur"
            });
        }
    }
);// =========================================================
// VALIDATION QR
// =========================================================

app.post(
    "/api/tickets/validate",
    authRequired,
    roleRequired(
        "company_admin",
        "company_agent",
        "super_admin"
    ),
    async (req, res) => {

        try {

            const {
                qr_token
            } = req.body;

            if (!qr_token) {

                return res.status(400).json({
                    success: false,
                    message:
                        "QR token manquant"
                });
            }

            const result =
                await pool.query(
                    `
                    SELECT
                        tk.*,

                        r.reservation_number,
                        r.status AS reservation_status,

                        t.departure_date,
                        t.departure_time,

                        ro.departure_city,
                        ro.arrival_city,

                        b.bus_number

                    FROM tickets tk

                    JOIN reservations r
                        ON r.id =
                        tk.reservation_id

                    JOIN trips t
                        ON t.id = r.trip_id

                    JOIN routes ro
                        ON ro.id = t.route_id

                    JOIN buses b
                        ON b.id = t.bus_id

                    WHERE tk.qr_token = $1
                    `,
                    [qr_token]
                );

            if (result.rows.length === 0) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Ticket invalide"
                });
            }

            const ticket =
                result.rows[0];

            if (ticket.status!== "ACTIVE") {

                return res.status(400).json({
                    success: false,
                    message:
                        "Ticket déjà utilisé ou annulé",
                    ticket
                });
            }

            const updated =
                await pool.query(
                    `
                    UPDATE tickets

                    SET
                        status = 'USED',
                        validated_at = NOW()

                    WHERE id = $1

                    RETURNING *
                    `,
                    [ticket.id]
                );

            res.json({
                success: true,
                message:
                    "Ticket validé avec succès",
                ticket:
                    updated.rows[0]
            });

        } catch (error) {

            console.error(error);

            res.status(500).json({
                success: false,
                message: "Erreur serveur"
            });
        }
    }
);

// =========================================================
// ESPACE COMPAGNIE
// =========================================================

app.get(
    "/api/company/reservations",
    authRequired,
    roleRequired(
        "company_admin",
        "company_agent",
        "super_admin"
    ),
    async (req, res) => {

        try {

            const result =
                await pool.query(
                    `
                    SELECT
                        r.id,
                        r.reservation_number,
                        r.total_amount,
                        r.status,
                        r.created_at,

                        u.first_name,
                        u.last_name,
                        u.phone,

                        t.departure_date,
                        t.departure_time,

                        ro.departure_city,
                        ro.arrival_city,

                        b.bus_number

                    FROM reservations r

                    JOIN users u
                        ON u.id = r.user_id

                    JOIN trips t
                        ON t.id = r.trip_id

                    JOIN routes ro
                        ON ro.id = t.route_id

                    JOIN buses b
                        ON b.id = t.bus_id

                    ORDER BY
                        r.created_at DESC
                    `
                );

            res.json({
                success: true,
                reservations:
                    result.rows
            });

        } catch (error) {

            console.error(error);

            res.status(500).json({
                success: false,
                message: "Erreur serveur"
            });
        }
    }
);

// =========================================================
// ADMIN DASHBOARD
// =========================================================

app.get(
    "/api/admin/dashboard",
    authRequired,
    roleRequired("super_admin"),
    async (req, res) => {

        try {

            const users =
                await pool.query(
                    `
                    SELECT COUNT(*) AS total
                    FROM users
                    `
                );

            const companies =
                await pool.query(
                    `
                    SELECT COUNT(*) AS total
                    FROM companies
                    `
                );

            const reservations =
                await pool.query(
                    `
                    SELECT COUNT(*) AS total
                    FROM reservations
                    `
                );

            const revenue =
                await pool.query(
                    `
                    SELECT
                        COALESCE(
                            SUM(amount),
                            0
                        ) AS total

                    FROM payments

                    WHERE status = 'SUCCESS'
                    `
                );

            res.json({
                success: true,

                dashboard: {

                    users:
                        Number(
                            users.rows[0].total
                        ),

                    companies:
                        Number(
                            companies.rows[0].total
                        ),

                    reservations:
                        Number(
                            reservations.rows[0].total
                        ),

                    revenue:
                        Number(
                            revenue.rows[0].total
                        )
                }
            });

        } catch (error) {

            console.error(error);

            res.status(500).json({
                success: false,
                message: "Erreur serveur"
            });
        }
    }
);

// =========================================================
// ADMIN UTILISATEURS
// =========================================================

app.get(
    "/api/admin/users",
    authRequired,
    roleRequired("super_admin"),
    async (req, res) => {

        try {

            const result =
                await pool.query(
                    `
                    SELECT
                        id,
                        first_name,
                        last_name,
                        phone,
                        email,
                        role,
                        status,
                        created_at

                    FROM users

                    ORDER BY
                        created_at DESC
                    `
                );

            res.json({
                success: true,
                users:
                    result.rows
            });

        } catch (error) {

            console.error(error);

            res.status(500).json({
                success: false,
                message: "Erreur serveur"
            });
        }
    }
);// =========================================================
// ADMIN COMPAGNIES
// =========================================================

app.get(
    "/api/admin/companies",
    authRequired,
    roleRequired("super_admin"),
    async (req, res) => {

        try {

            const result =
                await pool.query(
                    `
                    SELECT
                        c.*,

                        COUNT(DISTINCT b.id)
                        AS bus_count

                    FROM companies c

                    LEFT JOIN buses b
                        ON b.company_id =
                        c.id

                    GROUP BY c.id

                    ORDER BY
                        c.created_at DESC
                    `
                );

            res.json({
                success: true,
                companies:
                    result.rows
            });

        } catch (error) {

            console.error(error);

            res.status(500).json({
                success: false,
                message: "Erreur serveur"
            });
        }
    }
);

// =========================================================
// ADMIN PAIEMENTS
// =========================================================

app.get(
    "/api/admin/payments",
    authRequired,
    roleRequired("super_admin"),
    async (req, res) => {

        try {

            const result =
                await pool.query(
                    `
                    SELECT
                        p.*,

                        r.reservation_number,

                        u.first_name,
                        u.last_name,
                        u.phone

                    FROM payments p

                    JOIN reservations r
                        ON r.id =
                        p.reservation_id

                    JOIN users u
                        ON u.id = r.user_id

                    ORDER BY
                        p.created_at DESC
                    `
                );

            res.json({
                success: true,
                payments:
                    result.rows
            });

        } catch (error) {

            console.error(error);

            res.status(500).json({
                success: false,
                message: "Erreur serveur"
            });
        }
    }
);

// =========================================================
// 404
// =========================================================

app.use((req, res) => {

    res.status(404).json({
        success: false,
        message: "Route introuvable",
        path: req.originalUrl
    });
});

// =========================================================
// ERREUR GLOBALE
// =========================================================

app.use(
    (error, req, res, next) => {

        console.error(error);

        res.status(500).json({
            success: false,
            message:
                "Erreur interne du serveur"
        });
    }
);

// =========================================================
// DÉMARRAGE
// =========================================================

app.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log(
            `Bénin Bus démarré sur le port ${PORT}`
        );

        console.log(
            `Frontend: http://localhost:${PORT}`
        );
    }
);