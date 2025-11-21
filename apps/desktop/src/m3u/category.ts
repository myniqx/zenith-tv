import { GroupObject } from "./group";
import { M3UObject } from "./m3u";
import { ListType } from "./types";
import { WatchableObject } from "./watchable";

export class Catalog extends GroupObject {
  recentlyAdded: GroupObject;
  watchedList: GroupObject;
  watchList: GroupObject;
  movieList: GroupObject;
  tvShowList: GroupObject;
  liveStreamList: GroupObject;
  isLoaded: boolean = false;

  m3uMap: Map<string, M3UObject> | null = null;

  public pushMessage: ((msg: string) => void) | undefined = undefined;

  /**
   * Sets the status message.
   *
   * @param {string} msg - The status message to be set.
   */
  set Status(msg: string) {
    if (this.pushMessage && typeof this.pushMessage === 'function') {
      this.pushMessage(msg);
    }
  }

  constructor(p: Profile) {
    super();
    this.profile = p;
    this.Name = "Catalog";
    this.recentlyAdded = <Ref<GroupObject>>ref<GroupObject>(this.addGroup("Recently"));
    this.watchedList = <Ref<GroupObject>>ref<GroupObject>(this.addGroup("Watched"));
    this.watchList = <Ref<GroupObject>>ref<GroupObject>(this.addGroup("Favor"));
    this.movieList = this.addGroup("Movies");
    this.tvShowList = this.addGroup("Tv Shows");
    this.liveStreamList = this.addGroup("Live Streams");

    this.recentlyAdded.value.GetListIcon = Icons.time_past;
    this.watchedList.value.GetListIcon = Icons.check;
    this.watchList.value.GetListIcon = Icons.heart;
    this.movieList.GetListIcon = Icons.film;
    this.tvShowList.GetListIcon = Icons.tvShow;
    this.liveStreamList.GetListIcon = Icons.livestream;
    this.loadFromJson();
  }

  public listedItems: Map<string, ListType> = new Map();
  public bannedGroups: Set<string> = new Set();
  public pinnedGroups: Set<string> = new Set();
  public latelyAdded: Map<Date, string[]> = new Map();

  /**
   * Sets the watchable list for a given watchable object.
   *
   * @param {WatchableObject} watchable - The watchable object.
   * @param {ListType} list - The list to set the watchable in.
   */
  public setWatchableList(watchable: WatchableObject, list: ListType) {
    if (watchable.listed === list) {
      return;
    }

    if (list === 'none') {
      this.listedItems.delete(watchable.Url);
    } else {
      this.listedItems.set(watchable.Url, list);
    }

    if (list !== 'favorite') {
      this.watchList.value.justRemove(watchable);
    }
    if (list !== 'watched') {
      this.watchedList.value.justRemove(watchable);
    }
    if (list === 'favorite') {
      this.watchList.value.justAdd(watchable);
    }
    if (list === 'watched') {
      this.watchedList.value.justAdd(watchable);
    }

    this.saveToJson();
  }

  /**
   * Generates a profile key based on the provided id and name.
   *
   * @param {number} id - The unique identifier for the profile.
   * @param {string} name - The name of the profile.
   * @return {string} The generated profile key.
   */
  public static profileKey(id: number, name: string) {
    return `profile#${id}#${name}`;
  }

  /**
   * Retrieves the profile key for the given name.
   *
   * @param {string} name - The name of the key.
   * @return {any} The profile key.
   */
  public profileKey(name: string) {
    return Catalog.profileKey(this.profile.id, name);
  }

  /**
   * Loads data from local storage and initializes the properties of the class.
   *
   * @param {string} itemName - The name of the item to retrieve from local storage.
   */
  public loadFromJson() {
    const key = (name: string) => Catalog.profileKey(this.profile.id, name);
    const getItemFromLocalStorage = (itemName: string) => {
      try {
        const data = localStorage.getItem(key(itemName));
        const val = JSON.parse(data ?? '[]');
        return val;
      }
      catch (e) {
        return [];
      }
    }

    this.pinnedGroups = new Set(getItemFromLocalStorage('pinnedGroups'));
    this.latelyAdded = new Map(getItemFromLocalStorage('latelyAdded'));
    this.bannedGroups = new Set(getItemFromLocalStorage('bannedGroups'));
    this.listedItems = new Map(getItemFromLocalStorage('listedItems'));
  }

  /**
   * Saves the current state of the object to local storage in JSON format.
   *
   * @param {string} name - The name of the object.
   * @return {void}
   */
  public saveToJson() {
    const key = (name: string) => Catalog.profileKey(this.profile.id, name);
    const data = {
      pinnedGroups: this.pinnedGroups.size > 0 ? [...this.pinnedGroups] : undefined,
      latelyAdded: this.latelyAdded.size > 0 ? [...this.latelyAdded] : undefined,
      bannedGroups: this.bannedGroups.size > 0 ? [...this.bannedGroups] : undefined,
      listedItems: this.listedItems.size > 0 ? [...this.listedItems] : undefined
    };
    Object.entries(data).forEach(([name, value]) => {
      if (value !== undefined) {
        const json = JSON.stringify(value);
        localStorage.setItem(key(name), json);
      } else {
        localStorage.removeItem(key(name));
      }
    });
  }

  public deleteJson() {
    Catalog.deleteJson(this.profile.id);
  }

  public static deleteJson(id: number) {
    localStorage.removeItem(Catalog.profileKey(id, 'pinnedGroups'));
    localStorage.removeItem(Catalog.profileKey(id, 'latelyAdded'));
    localStorage.removeItem(Catalog.profileKey(id, 'bannedGroups'));
    localStorage.removeItem(Catalog.profileKey(id, 'listedItems'));
  }

  /**
   * Checks if the given ViewObject should be filtered.
   *
   * @param {ViewObject} v - The ViewObject to be checked.
   * @return {boolean} Returns true if the ViewObject should be filtered, false otherwise.
   */
  public shouldFilter(v: ViewObject): boolean {
    return v instanceof GroupObject &&
      this.bannedGroups.has(v.Name) === false;
  }

  /**
   * Retrieves the total count by summing the total counts of the movie list,
   * tv show list, and live stream list.
   *
   * @return {number} The total count.
   */
  get TotalCount(): number {
    return this.movieList.TotalCount +
      this.tvShowList.TotalCount +
      this.liveStreamList.TotalCount;
  }

  /**
   * Returns the total number of unique groups in the movieList, tvShowList, and liveStreamList.
   *
   * @return {number} The total number of unique groups.
   */
  get GroupCount(): number {
    const groutSet = new Set<string>();
    this.movieList.Groups.map(m => groutSet.add(m.Name));
    this.tvShowList.Groups.map(m => groutSet.add(m.Name));
    this.liveStreamList.Groups.map(m => groutSet.add(m.Name));
    return groutSet.size;
  }

  /**
   * Returns the number of live streams.
   *
   * @return {number} The number of live streams.
   */
  get LiveStreamCount(): number {
    return this.liveStreamList.LiveStreamCount;
  }

  /**
   * Retrieves the number of seasons for a TV show.
   *
   * @return {number} The total number of seasons for the TV show.
   */
  get TvShowSeasonCount(): number {
    return this.tvShowList.TvShowSeasonCount;
  }

  /**
   * Retrieves the number of episodes for the TV show.
   *
   * @return {number} The total number of episodes.
   */
  get TvShowEpisodeCount(): number {
    return this.tvShowList.TvShowEpisodeCount;
  }

  /**
   * A description of the entire function.
   *
   * @return {number} description of return value
   */
  get MovieCount(): number {
    return this.movieList.MovieCount;
  }

  /**
   * Retrieves the number of TV shows in the list.
   *
   * @return {number} The total count of TV shows.
   */
  get TvShowCount(): number {
    return this.tvShowList.TvShowCount;
  }

  /**
   * Adds an M3U list to the current object.
   *
   * @param {M3UObject[]} list - The list of M3U objects to be added.
   */
  public addM3UList(list: M3UObject[]) {
    if (list.length > 0) this.isLoaded = true;

    if (!this.m3uMap) {
      this.addAndBuildFilter(list);
      return;
    }

    const addedList = this.addWithFilter(list);
    const date = new Date();
    for (const item of addedList) {
      item.AddedDate = date;
      this.recentlyAdded.value.Add(item.m3UObject);
    }
    this.recentlyAdded.value.lastCheck();
    this.latelyAdded.set(date, addedList.map(m => m.Url));
  }

  /**
   * Adds a list of M3UObjects to the current object's watchable list
   * after filtering out any duplicates.
   *
   * @param {M3UObject[]} list - The list of M3UObjects to add.
   * @return {WatchableObject[]} - The list of WatchableObjects that were added.
   */
  private addWithFilter(list: M3UObject[]): WatchableObject[] {
    const addedList: WatchableObject[] = [];
    const _map = this.m3uMap ?? new Map();
    for (const item of list) {
      if (_map.has(item.urlTvg)) {
        continue;
      }
      const added = this.Add(item);
      addedList.push(added);
    }
    return addedList;
  }

  /**
   * Adds and builds the filter using the provided list of M3UObjects.
   *
   * @param {M3UObject[]} list - The list of M3UObjects to add and build the filter with.
   */
  private addAndBuildFilter(list: M3UObject[]) {
    this.m3uMap = new Map();

    for (const item of list) {
      this.m3uMap.set(item.urlTvg, item);
      this.Add(item);
    }

    for (const [key, value] of this.listedItems) {
      const item = this.findByUrl(key);
      if (!item) {
        continue;
      }
      item.listed = value;
      if (value == EList.WATCHED)
        this.watchedList.value.justAdd(item);
      else
        this.watchList.value.justAdd(item);
    }

    const currentDate = new Date().getTime();
    const removeList = [];
    for (const [key, urls] of this.latelyAdded) {
      if (currentDate - key.getTime() > 31 * 24 * 60 * 60 * 1000) {
        removeList.push(key);
      }
      else {
        for (const url of urls) {
          const item = this.findByUrl(url);
          if (!item) {
            continue;
          }
          item.AddedDate = key;
          this.recentlyAdded.value.Add(item.m3UObject);
        }
      }
    }
    for (const key of removeList) {
      this.latelyAdded.delete(key);
    }
    this.lastCheck();
  }

  /**
   * Adds an M3UObject to the appropriate list based on its type.
   *
   * @param {M3UObject} m3u - The M3UObject to be added.
   * @return {WatchableObject} The modified WatchableObject list.
   */
  public Add(m3u: M3UObject): WatchableObject {
    if (m3u.isLiveStream())
      return this.liveStreamList.addGroup(m3u.groupTitle).Add(m3u);
    else if (m3u.isTvShow())
      return this.tvShowList.addGroup(m3u.groupTitle).Add(m3u);
    return this.movieList.addGroup(m3u.groupTitle).Add(m3u);
  }

  /**
   * Executes the last check operation for all the relevant components.
   *
   * @param {void} - This function does not take any parameters.
   * @return {void} - This function does not return any value.
   */
  public lastCheck(): void {
    this.recentlyAdded.value.lastCheck();
    this.watchedList.value.lastCheck();
    this.watchList.value.lastCheck();

    this.movieList.lastCheck();
    this.tvShowList.lastCheck();
    this.liveStreamList.lastCheck();
  }

  /**
   * Modifies the group before it is added.
   *
   * @param {GroupObject} group - The group object to be modified.
   * @return {GroupObject} - The modified group object.
   */
  public modifyGroupBeforeAdded(group: GroupObject): GroupObject {
    group.isSticky = this.pinnedGroups.has(group.Name);
    return group;
  }

  /**
   * Makes a request to the specified URL and returns a Promise.
   *
   * @param {string} url - The URL to make the request to.
   * @return {Promise<any>} A Promise that resolves with the response if the request is successful, or rejects with an error message if the request fails.
   
  private makeRequest(url: string): Promise<any> {
      return new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('GET', url, true);
          xhr.onload = () => {
              console.log("makeRequest xhr.status: " + xhr.status + "xhr.readyState: " + xhr.readyState);
              if (xhr.status >= 200 && xhr.status < 300) {
                  resolve(xhr.response);
              } else {
                  reject(xhr.statusText);
              }
          };
          xhr.onerror = () => {
              reject(xhr.statusText);
          };
          xhr.send();
      });
  }*/

  /**
   * Fetches a text file from the specified URL.
   *
   * @param {string} url - The URL of the text file to fetch.
   * @return {Promise<string>} A promise that resolves to the content of the text file.
   * @throws {Error} If an error occurs during the fetch operation.
   */
  private async fetchTextFile(url: string): Promise<string> {
    try {
      const apiUrl = '/check-m3u/' + encodeURIComponent(url);
      const response = await fetch(apiUrl);
      const reader = response.body?.getReader();

      if (!reader) {
        throw new Error('An error.');
      }

      let receivedLength = 0;
      const contentLength = parseInt(response.headers.get('Content-Length') || '0', 10);
      const chunks: Uint8Array[] = [];
      let loop = true;
      let lastProgress = 0;
      while (loop) {
        const { done, value } = await reader.read();

        if (done) {
          loop = false;
          continue;
        }

        if (!value)
          continue;

        chunks.push(value);
        receivedLength += value.length;

        const progress = (receivedLength / contentLength) * 100;
        if (progress - lastProgress > 1.23) {
          this.Status = `Downloading: ${progress.toFixed(2)}% ${receivedLength} of ${contentLength}`;
          lastProgress = progress;
        }
      }

      const chunksAll = new Uint8Array(receivedLength);
      let position = 0;

      for (const chunk of chunks) {
        chunksAll.set(chunk, position);
        position += chunk.length;
      }

      this.Status = "Download completed...";
      const result = new TextDecoder('utf-8').decode(chunksAll);
      this.isLoaded = false;
      return result;
    } catch (error) {
      console.error('An error occurred on fetchTextFile:', error);
      throw error;
    }
  }

  public M3UObjects: Array<M3UObject> | null = null;

  /**
   * Downloads the M3U file from the specified URL, parses it, and writes the data to the database.
   * 
   * @return {Promise<M3UObject[] | null>} An array of M3UObjects if successful, or null if an error occurred.
   */
  private async Download(): Promise<M3UObject[] | null> {
    try {
      const data = await this.fetchTextFile(this.profile.url);
      const parser = new M3UFileParser(data);
      const objects = await parser.loadM3U();
      await this.writeToDatabase(data);
      return objects;
    }
    catch (e) {
      console.log(e);
    }
    return null;
  }

  /**
  Reads data from the database and parses it as M3U objects.

  @returns A promise that resolves to an array of M3UObjects 
           or null if there is no data available.
  */
  private async Read(): Promise<M3UObject[] | null> {
    try {
      const data = await this.readFromDatabase();
      if (!data) return null;

      const parser = new M3UFileParser(data);
      const objects = await parser.loadM3U();
      return objects;
    }
    catch (e) {
      console.log(e);
    }
    return null;
  }

  /**
   * Loads the data, either from cache or by downloading it if necessary.
   *
   * @param {boolean} downloadToo - Indicates whether to download the data if it is not already loaded.
   * @param {((msg: string) => void) | undefined} pushMessage - A callback function to push a message.
   * @return {Promise<boolean>} - A promise that resolves to a boolean indicating whether the data was successfully loaded.
   */
  public async Load(downloadToo: boolean, pushMessage: ((msg: string) => void) | undefined): Promise<boolean> {
    //if its already loaded just return
    if (this.isLoaded) {
      return true;
    }
    this.pushMessage = pushMessage;

    this.Status = "profile begins to load...";

    let objects = await this.Read();
    if (objects)
      this.addM3UList(objects);

    if (!objects || downloadToo) {
      objects = await this.Download();
      if (objects)
        this.addM3UList(objects);
      else
        return false;
    }

    if (this.isLoaded) {
      this.Status = "profile loaded.";
      const p = this.profile;
      p.groupCount = this.GroupCount;
      p.tvShowCount = this.movieList.TvShowCount;
      p.tvShowSeasonCount = this.movieList.TvShowSeasonCount;
      p.tvShowEpisodeCount = this.movieList.TvShowEpisodeCount;
      p.liveStreamCount = this.movieList.LiveStreamCount;
      p.movieCount = this.movieList.MovieCount;
      p.totalCount = this.TotalCount;
      return true;
    }
    return false;
  }

  /**
   * Writes the given data to the database.
   *
   * @param {string} data - The data to be written to the database.
   * @return {Promise<boolean>} A Promise that resolves to true if the data was written successfully, otherwise false.
   */
  private async writeToDatabase(data: string): Promise<boolean> {
    try {
      const db = new DataBase();
      const key = this.profileKey("m3u");
      await db.openDatabase();
      await db.setData(key, data);
      return true;
    }
    catch (e) {
      console.log("writeToDatabase is failed", e);
    }
    return false;
  }

  /**
   * Reads data from the database and returns it.
   *
   * @return {Promise<string | null>} The data retrieved from the database, or null if an error occurred.
   */
  private async readFromDatabase(): Promise<string | null> {
    try {
      const db = new DataBase();
      const key = this.profileKey("m3u");
      await db.openDatabase();
      return await db.getDataByKey(key);
    }
    catch (e) {
      console.log("readFromDatabase is failed", e);
    }
    return null;
  }

  private abortController: AbortController | null = null;
  /**
   * Starts a search operation.
   *
   * @param {string} text - The text to search for.
   * @param {any} group - The group to search within.
   * @returns {Promise<boolean>} A promise that resolves to a boolean value indicating whether the search was successfully started.
   */
  public startSearch(text: string, group: any): Promise<boolean> {
    if (this.abortController != null)
      this.abortController.abort();

    this.abortController = new AbortController();
    const abortController = this.abortController;

    return new Promise((resolve) => {
      const parts = text.toLowerCase().split(" ").map(x => x.trim());
      this.searchProgress(group, parts, abortController);
      resolve(abortController.signal.aborted === false);
    });
  }

}
