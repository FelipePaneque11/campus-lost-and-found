async function loadItems() {
        const list = document.getElementById("item-list");

        try {
            const params = new URLSearchParams(window.location.search);
            const search = params.get("search") || "";

            document.getElementById("search").value = search;

            const response = await fetch("/api/items?search=" + encodeURIComponent(search));

            if (!response.ok) {
                throw new Error("Could not load items");
            }

            const items = await response.json();

            if (items.length === 0) {
                list.textContent = "No items found.";
                return;
            }

            for (const item of items) {
                const row = document.createElement("li");

                const details = document.createElement("span");
                details.textContent = item.name + " — " + item.location;

                const claimLink = document.createElement("a");
                claimLink.href = "/items/" + item.id + "/claim";
                claimLink.textContent = "Claim this item";

                row.append(details, " ", claimLink);
                list.appendChild(row);
            }
        } catch (error) {
            list.textContent = "Could not load the items. Please refresh to try again.";
        }
    }

    loadItems();