// =========================================================
// BÉNIN BUS
// API CLIENT
// =========================================================

const BENIN_BUS_API =
    "https://TON-BACKEND.onrender.com/api";


// =========================================================
// OUTIL PRINCIPAL
// =========================================================

async function apiRequest(
    endpoint,
    options = {}
) {

    const token =
        localStorage.getItem("bb_token");

    const headers = {
        "Content-Type": "application/json",
        ...(options.headers || {})
    };


    if (token) {

        headers.Authorization =
            "Bearer " + token;

    }


    try {

        const response =
            await fetch(
                BENIN_BUS_API + endpoint,
                {
                    ...options,
                    headers
                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data.message ||
                "Erreur API"
            );

        }


        return data;


    } catch (error) {

        console.error(
            "Bénin Bus API:",
            error
        );

        throw error;

    }

}


// =========================================================
// AUTHENTIFICATION
// =========================================================

async function registerUser(data) {

    const result =
        await apiRequest(
            "/auth/register",
            {
                method: "POST",
                body: JSON.stringify(data)
            }
        );


    if (result.token) {

        localStorage.setItem(
            "bb_token",
            result.token
        );

    }


    if (result.user) {

        localStorage.setItem(
            "bb_user",
            JSON.stringify(result.user)
        );

    }


    return result;

}


async function loginUser(
    phone,
    password
) {

    const result =
        await apiRequest(
            "/auth/login",
            {
                method: "POST",

                body: JSON.stringify({
                    phone,
                    password
                })
            }
        );


    if (result.token) {

        localStorage.setItem(
            "bb_token",
            result.token
        );

    }


    if (result.user) {

        localStorage.setItem(
            "bb_user",
            JSON.stringify(result.user)
        );

    }


    return result;

}


function logoutUser() {

    localStorage.removeItem(
        "bb_token"
    );

    localStorage.removeItem(
        "bb_user"
    );

}


async function getMyProfile() {

    return await apiRequest(
        "/auth/me"
    );

}


// =========================================================
// ROUTES
// =========================================================

async function getRoutes() {

    return await apiRequest(
        "/routes"
    );

}


// =========================================================
// TRAJETS
// =========================================================

async function getTrips(
    departure = "",
    arrival = "",
    date = ""
) {

    const params =
        new URLSearchParams();


    if (departure) {

        params.set(
            "departure",
            departure
        );

    }


    if (arrival) {

        params.set(
            "arrival",
            arrival
        );

    }


    if (date) {

        params.set(
            "date",
            date
        );

    }


    const query =
        params.toString();


    return await apiRequest(
        "/trips" +
        (query ? "?" + query : "")
    );

}


// =========================================================
// SIÈGES
// =========================================================

async function getTripSeats(
    tripId
) {

    return await apiRequest(
        "/trips/" +
        tripId +
        "/seats"
    );

}


// =========================================================
// RÉSERVATION
// =========================================================

async function createReservation(
    data
) {

    return await apiRequest(
        "/reservations",
        {
            method: "POST",

            body: JSON.stringify(data)
        }
    );

}


async function getMyReservations() {

    return await apiRequest(
        "/reservations/my"
    );

}


async function cancelReservation(
    reservationId
) {

    return await apiRequest(
        "/reservations/" +
        reservationId +
        "/cancel",
        {
            method: "POST"
        }
    );

}


// =========================================================
// PAIEMENT
// =========================================================

async function createPayment(
    reservationId,
    provider
) {

    return await apiRequest(
        "/payments",
        {
            method: "POST",

            body: JSON.stringify({

                reservation_id:
                    reservationId,

                provider:
                    provider

            })
        }
    );

}


// =========================================================
// PAIEMENT DE TEST
// =========================================================
// À utiliser uniquement pendant le développement.

async function demoPaymentSuccess(
    paymentId
) {

    return await apiRequest(
        "/payments/" +
        paymentId +
        "/demo-success",
        {
            method: "POST"
        }
    );

}


// =========================================================
// TICKET
// =========================================================

async function getTicket(
    ticketId
) {

    return await apiRequest(
        "/tickets/" +
        ticketId
    );

}


// =========================================================
// COMPAGNIE
// =========================================================

async function getCompanyReservations() {

    return await apiRequest(
        "/company/reservations"
    );

}


async function validateTicket(
    qrToken
) {

    return await apiRequest(
        "/tickets/validate",
        {
            method: "POST",

            body: JSON.stringify({
                qr_token: qrToken
            })
        }
    );

}


// =========================================================
// ADMIN
// =========================================================

async function getAdminDashboard() {

    return await apiRequest(
        "/admin/dashboard"
    );

}


async function getAdminUsers() {

    return await apiRequest(
        "/admin/users"
    );

}


async function getAdminCompanies() {

    return await apiRequest(
        "/admin/companies"
    );

}


async function getAdminPayments() {

    return await apiRequest(
        "/admin/payments"
    );

}


// =========================================================
// TEST API
// =========================================================

async function testBeninBusAPI() {

    try {

        const result =
            await apiRequest(
                "/health"
            );


        console.log(
            "API Bénin Bus:",
            result
        );


        return result;

    } catch (error) {

        console.error(
            "API Bénin Bus inaccessible:",
            error
        );

        throw error;

    }

}
