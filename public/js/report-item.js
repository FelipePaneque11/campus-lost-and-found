const nameInput = document.getElementById("item-name");
const locationInput = document.getElementById("location")
const preview = document.getElementById("preview")

function updatePreview(){
    const name = nameInput.value.trim() || "Item name";
    const location = locationInput.value.trim() || "Location";

    //display what hte student typed as plain text
    preview.textContent = name + " - " + location;
}

nameInput.addEventListener("input", updatePreview);
locationInput.addEventListener("input", updatePreview);