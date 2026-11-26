async function loadClaims() {
    const message = document.getElementById("message");
    const container = document.getElementById("claims");
    const template = document.getElementById("claim-card");

    try {
        const response = await fetch("/api/moderator/claims");
        if (!response.ok) {
            throw new Error("Could not load claims");
        }

        const claims = await response.json();

        if (claims.length === 0) {
            message.textContent = "No pending claims.";
        }

        for (const claim of claims) {
            const card = template.content.cloneNode(true);

            card.querySelector("h2").textContent = claim.item_name;
            card.querySelector("p").textContent = claim.identifying_detail;
            card.querySelector("form").action = "/moderator/claims/" + claim.id + "/review";

            container.appendChild(card);
        }
    } catch (error) {
        message.textContent = "Could not load the queue. Sign in again and retry.";
    }
}

loadClaims();