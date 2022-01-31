const USERS_URL = "https://json.medrating.org/users";
const ALBUMS_URL = "https://json.medrating.org/albums";
const PHOTOS_URL = "https://json.medrating.org/photos";
const wrapper = document.querySelector(".wrapper");
const header = document.querySelector(".header");
const mainNavigation = document.querySelector(".users");
const main = document.querySelector(".page");
const itemsBookmark = document.querySelector(".items__bookmark");

const delay = ms =>
  new Promise(resolve => {
    setTimeout(resolve, ms);
  });

const LOAD_STATUSES = {
  LOADING: "loading",
  LOADED: "loaded",
  ERROR: "error",
};

class BaseUIVew {
  #nativeElement = null;

  get template() {
    throw new Error();
  }

  get nativeElement() {
    return this.#nativeElement;
  }
  _createElement() {
    throw new Error();
  }

  destroy() {
    this.#nativeElement.remove();
  }

  render() {
    this.#nativeElement = this._createElement(this.template);
  }
}

class ULListView extends BaseUIVew {
  #items = [];
  #getTemplate = () => `<li></li>`;
  constructor(items, getTemplate) {
    super();

    this.#items = items;
    this.#getTemplate = getTemplate;
  }
  get template() {
    return `<ul>
          ${this.#items.map(x => this.#getTemplate(x)).join("")}
        </ul>`;
  }
  addOnClickListener(cb) {
    if (!this.nativeElement) {
      console.warn(
        "You can not set on click listener until you dont call render method"
      );
      return;
    }

    this.nativeElement.addEventListener("click", cb);
  }
  _createElement(template) {
    const wrapElement = document.createElement("div");
    wrapElement.innerHTML = template;
    return wrapElement.firstChild;
  }
}

class LoaderView extends ULListView {
  get template() {
    return `<h2 id="loading" class="loading"><img class="img__loading" src="img/loader.gif" alt=""></h2>`;
  }
}

class ErrorView extends ULListView {
  get template() {
    return `<div id="error" class="error"><div class="img"><img class="img__error" src="img/error.png" alt="">
    <ul class="img__block">
    <li>Сервер не отвечает</li>
    <li>Уже работаем над этим</li>
    </ul>
    </div>
    </div>`;
  }
}

class OpenPhotoView extends ULListView {
  #name = null;

  constructor(name) {
    super();
    this.#name = name;
  }
  get template() {
    return `<div class="big__img_container"><img class="big__img _container" src="${
      this.#name
    }" alt=""><div class="close__photo"><img class="close__img" src="img/Close_modal.png" alt=""><div>
          
          </div>`;
  }
}
class ApiExecutor {
  async load(url) {
    const response = await fetch(url);
    await delay(500);
    const res = await response.json();

    return res;
  }
}

class MainHandler {
  #usersList = null;
  #userStatuses = {}; // key = userId, context = view, status = LOAD_STATUSES. handler = AlbumHandler
  async run() {
    const apiExecutor = new ApiExecutor();
    const loadedUsers = await apiExecutor.load(USERS_URL);
    this.#usersList = new ULListView(
      loadedUsers,
      user =>
        `<li  class="user"><a data-user-id="${user.id}" href="#" class="userLink">${user.name}<span class=""></span></a></li>`
    );

    this.#usersList.render();

    this.#usersList.nativeElement.className = "user__items";
  }
  renderMainApp() {
    mainNavigation.append(this.#usersList.nativeElement);

    this.#usersList.addOnClickListener(event => {
      const { target } = event;
      if (!target.dataset.userId) {
        return;
      }

      const userId = target.dataset.userId;
      this.#handleUserClick(userId, target);
    });
  }
  #handleUserClick(userId, target) {
    const currentStatus = this.#userStatuses[userId];

    if (!currentStatus) {
      this.#requestAlbums(userId, target);

      target.closest(".user").classList.add("pseudo__element");
      return;
    }

    target.closest(".user").classList.remove("pseudo__element");
    currentStatus.context?.destroy();
    currentStatus.handler?.destroy();
    this.#userStatuses[userId] = null;
  }

  async #requestAlbums(userId, targetAlbum) {
    this.#userStatuses[userId] = { status: LOAD_STATUSES.LOADING };

    const loader = new LoaderView();
    loader.render();
    targetAlbum.closest(".user").append(loader.nativeElement);

    try {
      const apiExecutor = new ApiExecutor();
      const albums = await apiExecutor.load(`${ALBUMS_URL}?userId=${userId}`);

      if (!this.#userStatuses[userId]) {
        return;
      }

      const albumsList = new ULListView(
        albums,
        album =>
          `<li class="album"><a href="#" data-album-id="${album.id}" class="albumLink">${album.title}</a></li>`
      );
      albumsList.render();
      albumsList.nativeElement.className = "user__albums";

      targetAlbum.closest(".user").append(albumsList.nativeElement);
      loader.destroy();

      this.#userStatuses[userId] = {
        status: LOAD_STATUSES.LOADED,
        context: albumsList,
        handler: new AlbumHandler(albumsList),
      };
    } catch (ex) {
      loader.destroy();
      const errorView = new ErrorView();
      errorView.render();
      targetAlbum.closest(".user").append(errorView.nativeElement);
      this.#userStatuses[userId] = {
        status: LOAD_STATUSES.ERROR,
        context: errorView,
      };
    }
  }
}

class AlbumHandler {
  #albumsStatuses = {};
  #albumsList = null;

  constructor(albumsList) {
    this.#albumsList = albumsList;

    this.#albumsList.addOnClickListener(event => {
      if (!event.target.dataset.albumId) {
        return;
      }

      const albumId = event.target.dataset.albumId;
      this.handleAlbumClick(albumId, event.target);
    });
  }
  destroy() {
    this.#albumsList = null;
    this.#albumsStatuses = {};
  }

  async handleAlbumClick(albumId, target) {
    const currentStatus = this.#albumsStatuses[albumId];

    if (!currentStatus) {
      this.#requetsPhotos(albumId, target);
      return;
    }

    currentStatus.context?.destroy();
    this.#albumsStatuses[albumId] = null;
  }
  async #requetsPhotos(albumId, targetAlbum) {
    this.#albumsStatuses[albumId] = { status: LOAD_STATUSES.LOADING };

    const loader = new LoaderView();
    loader.render();
    targetAlbum.closest(".album").append(loader.nativeElement);

    try {
      const apiExecutor = new ApiExecutor();
      const photos = await apiExecutor.load(`${PHOTOS_URL}?albumId=${albumId}`);
      const pushToBookmark = new PushToBookmark(photos);
      pushToBookmark.pushToBookmark();
      if (!this.#albumsStatuses[albumId]) {
        return;
      }
      const bookmarkStar = (arr, val) => {
        const boolean = arr.some(arrVal => val === arrVal.id);
        return boolean ? "img/star_active.png" : "img/star_empty.png";
      };
      const photosList = new ULListView(
        photos,
        photo =>
          ` <li class="photo" id="${photo.id}"><img class="small__img" name="${
            photo.url
          }" src="${
            photo.thumbnailUrl
          }" alt=""><img class= "push__to_bookmark"src=${bookmarkStar(
            getAllItems(),
            photo.id
          )} alt=""><p class="image">${photo.title}</p></li>`
      );
      photosList.render();
      photosList.nativeElement.className = "user__photos";

      targetAlbum.closest(".album").append(photosList.nativeElement);
      loader.destroy();

      this.#albumsStatuses[albumId] = {
        status: LOAD_STATUSES.LOADED,
        context: photosList,
      };
    } catch (ex) {
      loader.destroy();
      const errorView = new ErrorView();
      errorView.render();
      targetAlbum.closest(".album").append(errorView.nativeElement);
      this.#albumsStatuses[albumId] = {
        status: LOAD_STATUSES.ERROR,
        context: errorView,
      };
    }
  }
}
function getAllItems() {
  const serialized = localStorage.getItem("items");

  if (!serialized) {
    return [];
  }

  return JSON.parse(serialized);
}
const setItems = val => localStorage.setItem("items", JSON.stringify(val));
const bookmarkImg = () => {
  const bookmarkImg = `<div class="bookmark"><img class="empty" src="img/empty.png" alt=""><h3>Список избранного пуст</h3><p>Добавляйте изображения, нажимая на звездочки</p></div>`;
  itemsBookmark.insertAdjacentHTML("beforeend", bookmarkImg);
};
const setItemsToDom = photos => {
  const bookmark = document.querySelector(".bookmark");
  const userPhotos = itemsBookmark.querySelector(".photos");
  if (userPhotos) {
    userPhotos.remove();
  }
  if (photos.length !== 0) {
    bookmark.style.display = "none";
    const photosList = new ULListView(
      photos,
      photo =>
        ` <li class="photo" id="${photo.id}"><img class="small__img" name="${photo.url}" src="${photo.thumbnailUrl}" alt=""><img class= "push__to_bookmark"src="img/star_active.png" alt=""><p class="title">${photo.title}</p></li>`
    );
    photosList.render();
    photosList.nativeElement.className = "photos _container";
    itemsBookmark.append(photosList.nativeElement);
  } else {
    bookmark.style.display = "block";
  }
};

const initialize = () => {
  const items = getAllItems();
  setItemsToDom(items);
};
class PushToBookmark {
  #photos = null;
  constructor(photos) {
    this.#photos = photos;
  }
  pushToBookmark() {
    const sharedFavouritesEvents = new FavouritesEvents();

    wrapper.addEventListener("click", e => {
      const { target } = e;
      switch (target.className) {
        case "push__to_bookmark":
          const targetItem = target.closest(".photo");
          const photoId = targetItem.id;
          if (target.getAttribute("src") === "img/star_empty.png") {
            const filteredPhotos = this.#photos.filter(
              item => item.id === Number(photoId)
            );
            target.setAttribute("src", "img/star_active.png");
            sharedFavouritesEvents.emit("add", ...filteredPhotos);
          } else {
            target.setAttribute("src", "img/star_empty.png");
            sharedFavouritesEvents.emit("remove", photoId);
          }
          break;
      }
    });
    sharedFavouritesEvents.openPhoto();
    sharedFavouritesEvents.subscribe((type, item) => {
      if (type === "add") {
        const items = getAllItems();
        const nextItems = [...items, item];
        setItems(nextItems);
        setItemsToDom(nextItems);
      }
      if (type === "remove") {
        const items = getAllItems();
        const filteredItems = items.filter(x => x.id !== Number(item));
        const nextItems = [...filteredItems];
        setItems(nextItems);
        setItemsToDom(nextItems);
      }
    });
  }
}

class TogggleHeader {
  toggleClassList(target) {
    document.querySelectorAll(".menu__item").forEach(item => {
      item.classList.remove("active");
    });
    target.classList.add("active");
  }
  selectHeader() {
    wrapper.addEventListener("click", e => {
      const { target } = e;
      switch (target.id) {
        case "Каталог":
          this.toggleClassList(target);
          target.classList.add("active");
          itemsBookmark.style.display = "none";
          location.reload();

          mainNavigation.style.display = "block";

          break;
        case "Избранное":
          this.toggleClassList(target);
          itemsBookmark.style.display = "block";
          mainNavigation.style.display = "none";
          initialize();
          break;
      }
    });
  }
}
class FavouritesEvents {
  #subscribers = [];
  subscribe(cb) {
    this.#subscribers.push(cb);
    return () => this.unsubscribe(cb);
  }

  unsubscribe(cb) {
    this.#subscribers = this.#subscribers.filter(x => x !== cb);
  }

  emit(type, item) {
    this.#subscribers.forEach(cb => cb(type, item));
  }

  openPhoto() {
    wrapper.addEventListener("click", e => {
      const { target } = e;
      switch (target.className) {
        case "small__img":
          const openPhotoView = new OpenPhotoView(target.name);
          openPhotoView.render();
          wrapper.append(openPhotoView.nativeElement);
          break;
        case "close__img":
          const wrapperChildren = document.querySelector(".big__img_container");
          wrapperChildren.remove();
          break;
      }
    });
  }
}

async function start() {
  const loader = new LoaderView();
  loader.render();

  try {
    bookmarkImg();
    const toggleHeader = new TogggleHeader();
    toggleHeader.selectHeader();

    loader.nativeElement.classList.add("loading__bookmark");
    mainNavigation.append(loader.nativeElement);
    const mainHandler = new MainHandler();
    await mainHandler.run();
    loader.destroy();
    mainHandler.renderMainApp();
  } catch (ex) {
    loader.destroy();
    const errorView = new ErrorView();
    errorView.render();
    loader.nativeElement.classList.add("error__bookmark");
    mainNavigation.append(errorView.nativeElement);
  }
}
start();
