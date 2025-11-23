import { LucideFolder, LucideIcon, LucideTv } from "lucide-react";
import { ViewObject } from "./view-object";
import { TvShowWatchableObject, WatchableObject } from "./watchable";
import { M3UObject } from "./m3u";

export class GroupObject extends ViewObject {

  public Watchables: WatchableObject[];
  public Groups: GroupObject[];
  public CoverImages: CoverItem[] | undefined = undefined;
  public GetListIcon: LucideIcon = LucideFolder;

  constructor(name = "Group", ListIcon = LucideFolder) {
    super();
    this.Name = name;
    this.GetListIcon = ListIcon;
    this.Groups = [];
    this.Watchables = [];
  }

  /**
   * Clears the Watchables and Groups arrays.
   *
   * @param {} - No parameters.
   * @return {} - No return value.
   */
  public clear() {
    this.Watchables = [];
    this.Groups = [];
  }

  /**
   * Determines whether the given view object should be filtered.
   *
   * @param {ViewObject} v - The view object to be checked.
   * @return {boolean} Returns true if the view object should be filtered, false otherwise.
   */
  public shouldFilter(v: ViewObject): boolean {
    return this.UpperLevel?.shouldFilter(v) ?? false;
  }

  /**
   * Adds the given item to the list of watchable objects.
   *
   * @param {WatchableObject} item - The item to be added.
   */
  public justAdd(item: WatchableObject) {
    this.Watchables.push(item);
  }

  /**
   * Removes the specified item from the Watchables array.
   *
   * @param {WatchableObject} item - The item to be removed.
   */
  public justRemove(item: WatchableObject) {
    const index = this.Watchables.indexOf(item);
    if (index !== -1) {
      this.Watchables.splice(index, 1);
    }
  }

  /**
   * Returns the total count of local items.
   *
   * @return {number} The total count of local items.
   */
  public localCount(): number {
    return this.Groups.length + this.Watchables.length;
  }

  /**
   * Performs the last check on all groups and sorts the groups and watchables.
   *
   * @return {void} 
   */
  public lastCheck() {
    for (let i = this.Groups.length - 1; i >= 0; i--) {
      const gr = this.Groups[i];
      gr.lastCheck();
      if (gr.TotalCount == 0)
        this.Groups.splice(i, 1);
    }
    const compare = (a: ViewObject, b: ViewObject) => {
      if (a.isSticky && !b.isSticky) return -1;
      if (!a.isSticky && b.isSticky) return 1;

      if (a.AddedDate && b.AddedDate) {
        const diff = b.AddedDate.getTime() - a.AddedDate.getTime();
        if (diff !== 0) return diff;
      } else if (a.AddedDate) {
        return -1;
      } else if (b.AddedDate) {
        return 1;
      }
      return a.Name.localeCompare(b.Name);
    };
    this.Groups.sort(compare);
    this.Watchables.sort(compare);
  }

  /**
   * Retrieves a list of cover images.
   *
   * @param {number} [limit=9] - The maximum number of cover images to retrieve.
   * @return {CoverItem[]} - An array of cover items representing the cover images.
   */
  public getImageList(limit: number = 9): CoverItem[] {
    if (this.CoverImages) return this.CoverImages;
    const result: CoverItem[] = [];
    const generateNumbers = (max: number, n: number) => {
      const result: number[] = [];
      const set: number[] = [];
      for (let i = 0; i < max; i++) set.push(i);
      if (n >= max) return set;   //return whole set
      for (let i = 0; i < n; i++) {
        const rand = Math.floor(Math.random() * set.length);
        const num = set.splice(rand, 1)[0];
        result.push(num);
      }
      return result;
    }

    const list = generateNumbers(this.Watchables.length, limit);
    for (const i of list) {
      const w = this.Watchables[i];
      result.push(new CoverItem(w.Name, w.Logo, w.isHot));
    }

    if (result.length < limit) {
      const temp: CoverItem[] = [];
      for (const g of this.Groups) temp.push(...g.getImageList());
      const list = generateNumbers(temp.length, limit - result.length);
      for (const i of list)
        result.push(temp[i]);
    }

    this.CoverImages = result;
    return this.CoverImages;
  }

  get TotalCount(): number {
    return this.Groups.reduce((total, g) => total + g.TotalCount, 0) +
      this.Watchables.length;
  }

  get LiveStreamCount(): number {
    return this.Groups.reduce((total, g) => total + g.LiveStreamCount, 0) +
      this.Watchables.reduce((total, w) => w.category === 'LiveStream' ? total + 1 : total, 0);
  }

  get TvShowSeasonCount(): number {
    let total: number = 0;
    for (const m of this.Groups) {
      if (m instanceof TvShowGroupObject) {
        total += m.seasonCount;
      } else if (m instanceof GroupObject) {
        total += m.TvShowSeasonCount;
      }
    }
    return total;
  }

  get TvShowEpisodeCount(): number {
    let total = 0;
    for (const m of this.Groups) {
      if (m instanceof TvShowGroupObject) {
        total += m.episodeCount;
      } else if (m instanceof GroupObject) {
        total += m.TvShowEpisodeCount;
      }
    }
    return total;
  }

  get MovieCount(): number {
    let total = 0;
    for (const m of this.Groups) {
      if (m instanceof TvShowGroupObject ||
        m instanceof TvShowSeasonGroupObject)
        continue;
      if (m instanceof GroupObject)
        total += (<GroupObject>m).MovieCount;
    }
    return this.Watchables.reduce((total, w) => w.category === 'Movie' ? total + 1 : total, total);
  }

  get TvShowCount(): number {
    return this.Groups.reduce((total, g) => g instanceof TvShowGroupObject ? total + 1 : total + g.TvShowCount, 0);
  }

  private setFrom(watchable: WatchableObject, m3u: M3UObject) {
    watchable.Url = m3u.url;
    watchable.Logo = m3u.logo ?? "";
    watchable.Name = m3u.title;
    watchable.Year = m3u.year;

    if (watchable instanceof TvShowWatchableObject) {
      watchable.Season = m3u.season ?? 1;
      watchable.Episode = m3u.episode ?? 1;
    }
  }

  public hasItem(item: WatchableObject): boolean {
    const group = this.Groups.find(g => g.Title === item.Title);
    return !!(group && group.Watchables.some(w => w.Url === item.Url));
  }

  public has(item: M3UObject): boolean {
    const group = this.Groups.find(g => g.Title === item.title);
    return !!(group && group.Watchables.some(w => w.Url === item.url));
  }

  public Add(m3u: M3UObject): WatchableObject {
    const obj = new WatchableObject();
    this.setFrom(obj, m3u);
    obj.UpperLevel = this;
    return this.AddWatchable(obj);
  }

  public AddWatchable(watchable: WatchableObject): WatchableObject {
    this.Watchables.push(watchable);
    return watchable;
  }

  public findByUrl(url: string): WatchableObject | undefined {
    for (const g of this.Groups) {
      const obj = g.findByUrl(url);
      if (obj) return obj;
    }
    return this.Watchables.find(w => w.Url === url) as WatchableObject;
  }

  public AddTvShow(m3u: M3UObject): WatchableObject {
    const tvShowGroup = this.addTvGroup(m3u.title);
    const tvShowSeazon = tvShowGroup.addSeason(m3u.season ?? 1);
    const tvShow = new TvShowWatchableObject();
    this.setFrom(tvShow, m3u);
    tvShow.UpperLevel = tvShowSeazon;
    tvShowSeazon.Watchables.push(tvShow);
    return tvShow;
  }

  addGroup(groupName: string): GroupObject {
    if (!groupName) {
      groupName = "unnamed group";
    }

    const group = this.Groups.find(g => g.Name === groupName);

    if (group) {
      return group;
    }

    const groupObject = new GroupObject();
    groupObject.Name = groupName;
    groupObject.UpperLevel = this;
    this.Groups.push(this.modifyGroupBeforeAdded(groupObject));
    return groupObject;
  }

  addTvGroup(groupName: string): TvShowGroupObject {
    if (!groupName) {
      groupName = "unnamed tvshow";
    }

    const group = this.Groups.find(g => g.Name === groupName);

    if (group) {
      return <TvShowGroupObject>group;
    }

    const groupObject = new TvShowGroupObject();
    groupObject.Name = groupName;
    groupObject.UpperLevel = this;
    this.Groups.push(this.modifyGroupBeforeAdded(groupObject));
    return groupObject;
  }

  public modifyGroupBeforeAdded(group: GroupObject): GroupObject {
    return group;
  }

  toString(): string {
    let str: string = "";
    for (const g of this.Groups) {
      str += g.Name + " " + g.Groups.length + " " + g.Watchables.length + "</br>";
    }
    return str;
  }

  public searchProgress(group: Ref<GroupObject>, parts: string[], abortController: AbortController) {
    for (const g of this.Groups) {
      if (abortController.signal.aborted) return;
      if (g instanceof TvShowGroupObject) {
        if (exString.hasMatch(parts, g.Name))
          group.value.Groups.push(g);
      }
      else
        g.searchProgress(group, parts, abortController);
    }
    for (const w of this.Watchables) {
      if (abortController.signal.aborted) return;
      if (exString.hasMatch(parts, w.Name))
        group.value.Watchables.push(w);
    }
  }

}

export class TvShowGroupObject extends GroupObject {

  get episodeCount(): number {
    return this.Groups.reduce((last, m) => m instanceof TvShowSeasonGroupObject ?
      last + (<TvShowSeasonGroupObject>m).episodeCount : last, this.Watchables.length);
  }

  get seasonCount(): number {
    return this.Groups.length;
  }

  addSeason(season: number): TvShowSeasonGroupObject {
    season = Math.max(1, season);
    const name = `Season ${season}`;

    const group = this.Groups.find(g => g.Name === name);

    if (group) {
      return group as TvShowSeasonGroupObject;
    }

    const groupObject = new TvShowSeasonGroupObject();
    groupObject.Season = season;
    groupObject.Name = name;
    groupObject.UpperLevel = this;
    this.Groups.push(groupObject);
    return groupObject;
  }

  getSeason(season: number): TvShowSeasonGroupObject | undefined {
    return this.Groups.find(g => g instanceof TvShowSeasonGroupObject && g.Season === season) as TvShowSeasonGroupObject;
  }

  getEpisode(season: number, episode: number): WatchableObject | undefined {
    return this.getSeason(season)?.getEpisode(episode);
  }

}

export class TvShowSeasonGroupObject extends GroupObject {
  constructor() {
    super();
    this.GetListIcon = LucideTv;
  }

  public getEpisode(episode: number): WatchableObject | undefined {
    return this.Watchables.find(w =>
      w instanceof TvShowWatchableObject &&
      (<TvShowWatchableObject>w).Episode === episode
    )
  }

  public Season: number = 0;
  get episodeCount(): number { return this.Watchables.length; }
}


class CoverItem {
  public Logo: string;
  public Name: string;
  public isHot: boolean;

  constructor(name: string, logo: string, isHot: boolean) {
    this.Name = name;
    this.isHot = isHot;
    this.Logo = logo;
  }
}
