function isMobile() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

ymaps.ready(function () {
  let myMap = new ymaps.Map("map-tula", {
    center: [54.1972, 37.6177],
    zoom: isMobile() ? 11 : 12,
    controls: ["routePanelControl"],
  });

  const routePanelControl = myMap.controls.get("routePanelControl");
  routePanelControl.options.set({
    allowSwitch: false,
  });

  let museums = [];
  let currentRoute;

  fetch("/museum.json")
    .then((response) => response.json())
    .then((data) => {
      museums = data.museums;
      createMuseumCheckboxes();
      displaySelectedMuseums();
    })
    .catch((error) => console.error("Ошибка при загрузке музеев:", error));

  function createMuseumCheckboxes() {
    const museumList = document.getElementById("museum-list");
    museumList.innerHTML = "";

    const selectedMuseums = museums.filter((museum) => museum.choosed);

    selectedMuseums.forEach((museum) => {
      const label = document.createElement("label");
      label.innerText = museum.name;

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = museum.name;
      checkbox.checked = true;

      label.appendChild(checkbox);
      museumList.appendChild(label);
      museumList.appendChild(document.createElement("br"));
    });
  }

  function displaySelectedMuseums() {
    const selectedMuseums = museums.filter((museum) => museum.choosed);

    selectedMuseums.forEach((museum) => {
      const placemark = new ymaps.Placemark(
        museum.coordinates,
        {
          balloonContent: museum.name,
        },
        {
          iconLayout: "default#image",
          iconImageHref: "../img/balloon2.png",
          iconImageSize: isMobile() ? [30, 30] : [50, 50],
          iconImageOffset: isMobile() ? [-15, -15] : [-25, -25],
        }
      );

      myMap.geoObjects.add(placemark);

      placemark.events.add("click", function () {
        placemark.properties.set(
          "balloonContentBody",
          `
            <div class="custom-balloon">
              <h3>${museum.name}</h3>
              <img src="${museum.image}" alt="${museum.name}" />
              <p>${museum.description}</p>
            </div>
          `
        );
        placemark.balloon.open();
      });
    });
  }

  if ("geolocation" in navigator) {
    navigator.geolocation.getCurrentPosition(
      function (pos) {
        const userCoordinates = [pos.coords.latitude, pos.coords.longitude];
        const control = myMap.controls.get("routePanelControl");
        control.routePanel.state.set({
          fromEnabled: true,
          from: userCoordinates,
          toEnabled: false,
        });
      },
      function (error) {
        console.error("Ошибка геолокации:", error.message);
        alert(
          "Не удалось определить ваше местоположение. Пожалуйста, введите его вручную."
        );
        const control = myMap.controls.get("routePanelControl");
        control.routePanel.state.set({
          fromEnabled: true,
          toEnabled: false,
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  } else {
    alert(
      "Геолокация не поддерживается вашим браузером. Пожалуйста, введите ваше местоположение вручную."
    );
    const control = myMap.controls.get("routePanelControl");
    control.routePanel.state.set({
      fromEnabled: true,
      toEnabled: false,
    });
  }

  function formatTime(totalMinutes) {
    let hours = Math.floor(totalMinutes / 60);
    let minutes = totalMinutes % 60;
    return (
      (hours < 10 ? "0" + hours : hours) +
      ":" +
      (minutes < 10 ? "0" + minutes : minutes)
    );
  }

  function sortMuseumsByTimeThenDistance(startCoordinates, museumsList) {
    let sortedByTime = museumsList
      .slice()
      .sort((a, b) => getClosingTime(a) - getClosingTime(b));
    console.log(
      "Список музеев, отсортированный только по времени закрытия:",
      sortedByTime.map(
        (museum) =>
          museum.name + " (" + formatTime(getClosingTime(museum)) + ")"
      )
    );
    let result = [];
    let currentPoint = startCoordinates;
    let remaining = sortedByTime.slice();
    while (remaining.length > 0) {
      let minTime = Math.min(...remaining.map((m) => getClosingTime(m)));
      let candidates = remaining.filter((m) => getClosingTime(m) === minTime);
      let chosen;
      if (candidates.length === 1) {
        chosen = candidates[0];
      } else {
        chosen = candidates.reduce((prev, curr) => {
          let dPrev = haversineDistance(currentPoint, prev.coordinates);
          let dCurr = haversineDistance(currentPoint, curr.coordinates);
          return dCurr < dPrev ? curr : prev;
        });
      }
      result.push(chosen);
      currentPoint = chosen.coordinates;
      remaining = remaining.filter((m) => m !== chosen);
    }
    return result;
  }

  function checkMuseumsAvailability(startCoordinates, museumsList, mode) {
    let currentTime = new Date();
    let currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
    const speed = {
      pedestrian: 6,
      auto: 30,
      masstransit: 20,
      bicycle: 15,
      taxi: 30,
    };
    const reachableMuseums = [];
    let currentCoordinates = startCoordinates;
    for (let i = 0; i < museumsList.length; i++) {
      const museum = museumsList[i];
      const distance = haversineDistance(
        currentCoordinates,
        museum.coordinates
      );
      const timeToTravel = (distance / speed[mode]) * 60;
      const visitTime = i === museumsList.length - 1 ? 60 : 90;
      const closingTime = getClosingTime(museum);
      const estimatedArrival = currentMinutes + timeToTravel;
      if (estimatedArrival + visitTime <= closingTime) {
        reachableMuseums.push(museum);
        currentMinutes = estimatedArrival + visitTime;
        currentCoordinates = museum.coordinates;
      }
    }
    return reachableMuseums;
  }

  function buildRoute(mode) {
    clearPreviousRouteOrRadius();
    const control = myMap.controls.get("routePanelControl");
    const fromCoordinates = control.routePanel.state.get("from");
    const selectedMuseums = Array.from(
      document.querySelectorAll('#museum-list input[type="checkbox"]:checked')
    ).map((checkbox) =>
      museums.find((museum) => museum.name === checkbox.value)
    );
    if (selectedMuseums.length === 0) {
      alert("Нет выбранных музеев для построения маршрута.");
      return;
    }
    const sortedMuseums = sortMuseumsByTimeThenDistance(
      fromCoordinates,
      selectedMuseums
    );

    const reachableMuseums = checkMuseumsAvailability(
      fromCoordinates,
      sortedMuseums,
      mode
    );
    const unreachableMuseums = sortedMuseums.filter(
      (museum) => !reachableMuseums.includes(museum)
    );
    const skippedCount = unreachableMuseums.length;

    if (skippedCount > 0) {
      alert(
        `Вы не успеете посетить следующие музеи: ${unreachableMuseums
          .map((m) => m.name)
          .join(", ")}. ` +
          `Маршрут будет построен по тем музеям, которые Вы точно успеете посетить.`
      );
    } else {
      alert("Вы успеете посетить все выбранные музеи.");
    }

    if (reachableMuseums.length > 0) {
      setMultiRoute(fromCoordinates, reachableMuseums, mode);
    } else {
      alert("К сожалению, вы не успеете посетить ни один из выбранных музеев.");
    }
  }

  function getClosingTime(museum) {
    const dayOfWeek = new Date().getDay();
    const days = [
      "Воскресенье",
      "Понедельник",
      "Вторник",
      "Среда",
      "Четверг",
      "Пятница",
      "Суббота",
    ];

    const closingHours = museum[days[dayOfWeek]];

    if (!closingHours) return Infinity;

    const [closingHour, closingMinute] = closingHours
      .split("-")[1]
      .split(":")
      .map(Number);

    return closingHour * 60 + closingMinute;
  }

  function setMultiRoute(fromCoordinates, selectedMuseums, routingMode) {
    myMap.geoObjects.removeAll();

    let referencePoints = [fromCoordinates];

    selectedMuseums.forEach((museum) => {
      referencePoints.push(museum.coordinates);
    });

    currentRoute = new ymaps.multiRouter.MultiRoute(
      {
        referencePoints: referencePoints,
        params: { routingMode: routingMode },
      },
      { boundsAutoApply: true }
    );

    myMap.geoObjects.add(currentRoute);

    currentRoute.model.events.add("requestsuccess", function () {
      calculateTotalDuration(currentRoute, selectedMuseums);
    });

    currentRoute.model.events.add("requestfail", function (event) {
      console.error("Ошибка при получении маршрута:", event);
    });
  }

  function calculateTotalDuration(currentRoute, selectedMuseums) {
    let totalDuration = 0;
    let activeRoute =
      typeof currentRoute.getActiveRoute === "function"
        ? currentRoute.getActiveRoute()
        : null;
    if (!activeRoute && currentRoute.getRoutes().getLength() > 0) {
      activeRoute = currentRoute.getRoutes().get(0);
    }
    if (activeRoute) {
      totalDuration = activeRoute.properties.get("duration").value;
    }

    const timeSpentAtEachMuseum = 5400;
    totalDuration += selectedMuseums.length * timeSpentAtEachMuseum;

    const totalHours = Math.floor(totalDuration / 3600);
    const totalMinutes = Math.floor((totalDuration % 3600) / 60);

    alert(
      "Общее время на посещение музеев: " +
        totalHours +
        " ч " +
        totalMinutes +
        " мин"
    );
  }

  function clearPreviousRouteOrRadius() {
    if (currentRoute) {
      myMap.geoObjects.remove(currentRoute);
      currentRoute = null;
    }
    myMap.geoObjects.removeAll();
  }

  function haversineDistance(coords1, coords2) {
    const toRad = (value) => (value * Math.PI) / 180;

    const R = 6371;
    const dLat = toRad(coords2[0] - coords1[0]);
    const dLon = toRad(coords2[1] - coords1[1]);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(coords1[0])) *
        Math.cos(toRad(coords2[0])) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  }

  document.getElementById("build-walk").onclick = function () {
    buildRoute("pedestrian");
  };

  document.getElementById("build-car").onclick = function () {
    buildRoute("auto");
  };

  document.getElementById("build-masstransit").onclick = function () {
    buildRoute("masstransit");
  };

  document.getElementById("build-bicycle").onclick = function () {
    buildRoute("bicycle");
  };

  document.getElementById("build-taxi").onclick = function () {
    buildRoute("taxi");
  };

  routePanelControl.routePanel.state.set({
    fromEnabled: true,
    toEnabled: false,
  });
});
