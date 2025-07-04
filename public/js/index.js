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
        console.log("Определено местоположение:", userCoordinates);

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

  function buildRoute(mode) {
    clearPreviousRouteOrRadius();

    const control = myMap.controls.get("routePanelControl");
    const fromCoordinates = control.routePanel.state.get("from");

    const selectedMuseums = Array.from(
      document.querySelectorAll('#museum-list input[type="checkbox"]:checked')
    ).map((checkbox) =>
      museums.find((museum) => museum.name === checkbox.value)
    );

    if (selectedMuseums.length > 0) {
      const sortedMuseums = sortMuseumsByDistance(
        fromCoordinates,
        selectedMuseums
      );
      setMultiRoute(fromCoordinates, sortedMuseums, mode);
    } else {
      alert("Нет доступных музеев для построения маршрута.");
    }
  }

  function sortMuseumsByDistance(userCoordinates, selectedMuseums) {
    return selectedMuseums.sort((a, b) => {
      const distanceA = haversineDistance(userCoordinates, a.coordinates);
      const distanceB = haversineDistance(userCoordinates, b.coordinates);
      return distanceA - distanceB;
    });
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
  }

  function buildRadius(radius) {
    clearPreviousRouteOrRadius();
    const control = myMap.controls.get("routePanelControl");
    const userCoordinates = control.routePanel.state.get("from");
    myMap.geoObjects.removeAll();
    const circle = new ymaps.Circle(
      [userCoordinates, radius],
      { balloonContent: `Радиус: ${radius} метров` },
      {
        fillColor: "rgba(200, 230, 201, 0.5)",
        strokeColor: "rgba(200, 230, 201, 1)",
        strokeWidth: 2,
      }
    );
    myMap.geoObjects.add(circle);
    museums.forEach((museum) => {
      if (museum.coordinates && museum.coordinates.length === 2) {
        const museumCoordinates = museum.coordinates;
        const distance = haversineDistance(userCoordinates, museumCoordinates);
        if (distance <= radius / 1000) {
          const placemark = new ymaps.Placemark(
            museumCoordinates,
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
        }
      }
    });
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

  function clearPreviousRouteOrRadius() {
    if (currentRoute) {
      myMap.geoObjects.remove(currentRoute);
      currentRoute = null;
    }
    myMap.geoObjects.removeAll();
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

  document.getElementById("build-radius").onclick = function () {
    const radius = document.getElementById("radius-slider").value;
    buildRadius(radius);
  };

  routePanelControl.routePanel.state.set({
    fromEnabled: true,
    toEnabled: false,
  });
});
