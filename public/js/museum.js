let museums = [];
let selectedMuseums = new Set();
let selectedRegions = new Set();
let selectedTypes = new Set();
let selectedAccessibility = new Set();

function isMobile() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

fetch("/museum.json")
  .then((response) => response.json())
  .then((data) => {
    console.log(data);
    if (data && Array.isArray(data.museums)) {
      museums = data.museums;
      createMuseumCards(museums);
    } else {
      console.error(
        "Ошибка: данные не содержат музеев или имеют неверный формат."
      );
    }
  })
  .catch((error) => console.error("Ошибка при загрузке музеев:", error));

function createMuseumCards(museumsToDisplay) {
  const museumList = document.getElementById("museum-list");
  museumList.innerHTML = "";
  if (!museumsToDisplay || museumsToDisplay.length === 0) {
    museumList.innerHTML = "<p>Нет музеев для отображения.</p>";
    return;
  }
  museumsToDisplay.forEach((museum) => {
    const card = document.createElement("div");
    card.className = "museum-card";

    const image = document.createElement("img");
    image.className = "museum-image";
    image.src = museum.image || "img/default_image.png";
    image.alt = museum.name;

    const title = document.createElement("div");
    title.className = "museum-title";
    title.innerText = museum.name;

    const infoButton = document.createElement("div");
    infoButton.className = "info-button";
    infoButton.innerHTML = "i";

    const infoContent = document.createElement("div");
    infoContent.className = "info-content";
    infoContent.style.display = "none";
    infoContent.innerHTML = `
        <strong>Время работы:</strong><br> ${formatWorkingHours(museum)}
        <br>
        <strong>Описание:</strong> ${museum.long_description || "Нет описания"}
        <br>
        <strong>Официальный сайт музея:</strong> ${
          museum.website
            ? `<a href="${museum.website}" target="_blank">${museum.website}</a>`
            : "нет данных"
        }
      `;

    card.appendChild(image);
    card.appendChild(title);
    card.appendChild(infoButton);
    card.appendChild(infoContent);

    if (selectedMuseums.has(museum.name)) {
      card.classList.add("selected");
    }

    card.addEventListener("click", function (event) {
      if (!isMobile() || (isMobile() && event.target !== infoButton)) {
        toggleMuseumSelection(museum.name, card);
      }
    });
    infoButton.addEventListener("click", function (event) {
      event.stopPropagation();
      toggleInfoDisplay(infoContent, image);
    });

    museumList.appendChild(card);
  });
}

function toggleSelection(set, value) {
  if (set.has(value)) {
    set.delete(value);
  } else {
    set.add(value);
  }
}

function toggleInfoDisplay(infoContent, image) {
  if (infoContent.style.display === "none") {
    infoContent.style.display = "block";
    image.style.display = "none";
  } else {
    infoContent.style.display = "none";
    image.style.display = "block";
  }
}

function formatWorkingHours(museum) {
  return Object.entries(museum)
    .filter(([key]) =>
      [
        "Понедельник",
        "Вторник",
        "Среда",
        "Четверг",
        "Пятница",
        "Суббота",
        "Воскресенье",
      ].includes(key)
    )
    .map(([day, hours]) => {
      const hoursText = hours ? hours : "Закрыто";
      return `${capitalizeFirstLetter(day)}: ${hoursText}`;
    })
    .join("<br>");
}

function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

function toggleMuseumSelection(museumName, card) {
  if (selectedMuseums.has(museumName)) {
    selectedMuseums.delete(museumName);
    card.classList.remove("selected");
  } else {
    selectedMuseums.add(museumName);
    card.classList.add("selected");
  }
}

document.getElementById("search-button").onclick = function () {
  const searchName = document.getElementById("search-name").value.toLowerCase();
  const searchKeywordsInput = document
    .getElementById("search-keywords")
    .value.toLowerCase();
  const searchKeywords = searchKeywordsInput
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);

  const selectedDateValue = document.getElementById("search-date").value;
  const selectedDate = selectedDateValue ? new Date(selectedDateValue) : null;

  let dayOfWeek = null;
  if (selectedDate) {
    dayOfWeek = getDayOfWeek(selectedDate);
  }

  const filteredMuseums = museums.filter((museum) => {
    const nameMatch =
      !searchName || museum.name.toLowerCase().includes(searchName);

    const keywordMatch =
      searchKeywords.length === 0 ||
      searchKeywords.every((keyword) =>
        museum.keywords.some((museumKeyword) =>
          museumKeyword.toLowerCase().includes(keyword)
        )
      );

    const regionMatch =
      selectedRegions.size === 0 || selectedRegions.has(museum.region);

    const typeMatch =
      selectedTypes.size === 0 ||
      (Array.isArray(museum.type) &&
        museum.type.some((type) => selectedTypes.has(type)));

    let dayMatch = true;
    if (dayOfWeek) {
      dayMatch =
        museum[dayOfWeek] !== undefined &&
        museum[dayOfWeek] !== null &&
        museum[dayOfWeek] !== "" &&
        museum[dayOfWeek] !== "Закрыто";
    }
    let accessibilityMatch = true;
    if (selectedAccessibility.size > 0) {
      accessibilityMatch = [...selectedAccessibility].every(
        (condition) => museum[condition]
      );
    }
    return (
      nameMatch &&
      keywordMatch &&
      regionMatch &&
      typeMatch &&
      dayMatch &&
      accessibilityMatch
    );
  });
  console.log(filteredMuseums);
  createMuseumCards(filteredMuseums);
};

document.getElementById("reset-button").onclick = function () {
  resetFilters();
};

function resetFilters() {
  document.getElementById("search-name").value = "";
  document.getElementById("search-keywords").value = "";
  document.getElementById("search-date").value = "";
  createMuseumCards(museums);
  selectedMuseums.clear();
  document
    .querySelectorAll(".museum-card.selected")
    .forEach((card) => card.classList.remove("selected"));
  selectedRegions.clear();
  selectedTypes.clear();
  selectedAccessibility.clear();

  updateCustomSelectDisplay();
}

document.getElementById("select-button").onclick = function () {
  const currentDate = new Date();
  const currentDay = getDayOfWeek(currentDate);
  const currentHour = currentDate.getHours();
  const currentMinute = currentDate.getMinutes();

  const closedMuseums = [];

  selectedMuseums.forEach((museumName) => {
    const museum = museums.find((m) => m.name === museumName);
    if (museum) {
      const workingHours = museum[currentDay];
      if (!workingHours || workingHours === "Закрыто") {
        closedMuseums.push(museumName);
      } else {
        const hours = workingHours.split("-");
        const [openHour, openMinute] = hours[0].split(":").map(Number);
        const [closeHour, closeMinute] = hours[1].split(":").map(Number);

        if (
          currentHour < openHour ||
          (currentHour === openHour && currentMinute < openMinute) ||
          currentHour > closeHour ||
          (currentHour === closeHour && currentMinute > closeMinute)
        ) {
          closedMuseums.push(museumName);
        }
      }
    }
  });

  if (closedMuseums.length > 0) {
    alert(`Следующие музеи сейчас закрыты: ${closedMuseums.join(", ")}`);
  } else {
    handleSelection2();
  }
};

document.getElementById("view-route-button").onclick = function () {
  handleSelection();
};

function handleSelection() {
  updateMuseumSelection(Array.from(selectedMuseums));
}

function handleSelection2() {
  if (selectedMuseums.size > 0) {
    updateMuseumSelection2(Array.from(selectedMuseums));
  } else {
    alert("Пожалуйста, выберите хотя бы один музей.");
  }
}

function updateMuseumSelection2(selectedMuseumsArray) {
  const updatedMuseums = museums.map((museum) => ({
    ...museum,
    choosed: selectedMuseumsArray.includes(museum.name),
  }));

  saveUpdatedMuseums2(updatedMuseums);
}

function updateMuseumSelection(selectedMuseumsArray) {
  const updatedMuseums = museums.map((museum) => ({
    ...museum,
    choosed: selectedMuseumsArray.includes(museum.name),
  }));

  saveUpdatedMuseums(updatedMuseums);
}

function saveUpdatedMuseums(updatedMuseums) {
  fetch("/save_museums", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ museums: updatedMuseums }),
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        fetchAdditionalData();
        window.location.href = "index.html";
      } else {
        console.error(data.error);
      }
    })
    .catch((error) => console.error("Ошибка при отправке данных:", error));
}

function saveUpdatedMuseums2(updatedMuseums) {
  fetch("/save_museums", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ museums: updatedMuseums }),
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        fetchAdditionalData();
        window.location.href = "togo.html";
      } else {
        console.error(data.error);
      }
    })
    .catch((error) => console.error("Ошибка при отправке данных:", error));
}

function fetchAdditionalData() {
  const selectedMuseumsArray = Array.from(selectedMuseums);

  const url = `https://example.com/api/museums?ids=${selectedMuseumsArray.join(
    ","
  )}`;

  fetch(url)
    .then((response) => response.json())
    .then((data) => {
      console.log("Дополнительные данные о музеях:", data);
    })
    .catch((error) =>
      console.error("Ошибка при получении дополнительных данных:", error)
    );
}

function closeAllSelect(currentSelect) {
  document.querySelectorAll(".custom-select").forEach((select) => {
    if (select !== currentSelect) {
      select.querySelector(".select-items").style.display = "none";
      select
        .querySelector(".select-selected")
        .classList.remove("select-arrow-active");
    }
  });
}

function getDayOfWeek(date) {
  const daysOfWeek = [
    "Воскресенье",
    "Понедельник",
    "Вторник",
    "Среда",
    "Четверг",
    "Пятница",
    "Суббота",
  ];
  return daysOfWeek[date.getDay()];
}

document.querySelectorAll(".custom-select").forEach((select) => {
  const selectItemsContainer = select.querySelector(".select-items");
  const selectSelectedDiv = select.querySelector(".select-selected");

  selectSelectedDiv.addEventListener("click", (e) => {
    e.stopPropagation();
    closeAllSelect(select);
    selectItemsContainer.style.display =
      selectItemsContainer.style.display === "block" ? "none" : "block";
    selectSelectedDiv.classList.toggle("select-arrow-active");
  });

  selectItemsContainer.querySelectorAll("div").forEach((item) => {
    item.addEventListener("click", (e) => {
      e.stopPropagation();
      const value = item.getAttribute("data-value");

      item.classList.toggle("selected");
      if (select.id === "region-select")
        toggleSelection(selectedRegions, value);
      if (select.id === "type-select") toggleSelection(selectedTypes, value);
      if (select.id === "accessibility-select")
        toggleSelection(selectedAccessibility, value);

      updateCustomSelectDisplay();
    });
  });
});

function updateCustomSelectDisplay() {
  document.querySelectorAll(".custom-select").forEach((select) => {
    const selectSelectedDiv = select.querySelector(".select-selected");

    if (select.id === "region-select") {
      selectSelectedDiv.textContent =
        selectedRegions.size > 0
          ? Array.from(selectedRegions).join(", ")
          : "Выберите регионы";
    } else if (select.id === "type-select") {
      selectSelectedDiv.textContent =
        selectedTypes.size > 0
          ? Array.from(selectedTypes).join(", ")
          : "Выберите типы музеев";
    } else if (select.id === "accessibility-select") {
      selectSelectedDiv.textContent =
        selectedAccessibility.size > 0
          ? Array.from(selectedAccessibility).join(", ")
          : "Выберите доступность";
    }
  });
}

window.addEventListener("orientationchange", function () {
  createMuseumCards(museums);
});
document.addEventListener("click", (e) => {
  if (!e.target.closest(".custom-select")) {
    closeAllSelect();
  }
});
