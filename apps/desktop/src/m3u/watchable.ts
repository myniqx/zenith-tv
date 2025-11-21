import { LucideCheck, LucideHeart, LucidePodcast, LucideTheater, LucideTv } from "lucide-react";
import { ListType, LucideIcon } from "./types";
import { ViewObject } from "./view-object";
import { M3UObject } from "./m3u";
import { UserItemData } from "@/types/electron";

export class WatchableObject extends ViewObject {
  [x: string]: string;

  public Url: string = "";
  public Group: string = "";
  public possibleLiveStream: boolean | null = null;
  public Year: number | undefined = undefined;
  public userData: UserItemData = {};

  public listed: ListType = 'none';

  /**
   * Retrieves the icon for the list based on the current list status.
   *
   * @return {LucideProps} The icon for the list.
   */
  get ListIcon(): LucideIcon | null {
    switch (this.listed) {
      case 'favorite': return LucideHeart;
      case 'watched': return LucideCheck;
      default: return null;
    }
  }

  public DateDiff: string = this.calculateDateDiff();

  /**
   * Returns the M3UObject representation of the current instance.
   *
   * @return {M3UObject} The M3UObject representation of the current instance.
   */
  protected getM3UObject(): M3UObject {
    const m3u: M3UObject = {
      title: this.Name,
      url: this.Url,
      group: this.Group,
      category: "Movie",
      logo: this.Logo,
      year: this.Year
    };
    //   m3u.date = this.AddedDate;
    //   m3u.possibleLiveStream = this.PossibleLiveStream;
    return m3u;
  }

  /**
   * Calculates the difference in days between the current date and the AddedDate property.
   *
   * @return {string} The number of days ago the AddedDate was, or an empty string if AddedDate is undefined.
   */
  private calculateDateDiff(): string {
    if (this.AddedDate !== undefined) {
      const now = new Date();
      const timeDiff = Math.floor((now.getTime() - this.AddedDate.getTime()) / (1000 * 60 * 60 * 24));
      return `${timeDiff} days ago.`;
    } else {
      return "";
    }
  }

  get isHot(): boolean {
    return this.AddedDate !== undefined;
  }


  /**
   * Checks if the current URL is possible live stream.
   * (basicly no extension no streaming...)
   *
   * @return {boolean} true if the URL is possible live stream, false otherwise.
   */
  public get PossibleLiveStream(): boolean {
    if (this.possibleLiveStream === null) {
      const i = this.Url.lastIndexOf('/');
      this.possibleLiveStream = i >= 0 ? this.Url.indexOf('.', i) === -1 : false;
    }
    return this.possibleLiveStream === true;
  }

  get Title(): string { return this.PossibleLiveStream ? "Live Stream" : "Movie"; }
  get TitleIcon(): LucideIcon { return this.PossibleLiveStream ? LucidePodcast : LucideTheater; }
}

export class TvShowWatchableObject extends WatchableObject {
  get Title(): string { return "Tv Shows"; }
  get TitleIcon(): LucideIcon { return LucideTv; }

  public Season: number = 0;
  public Episode: number = 0;

  /**
   * Returns the m3UObject with additional TV show information.
   *
   * @return {M3UObject} The m3UObject with TV show information.
   */
  get m3UObject(): M3UObject {
    const m3u = super.getM3UObject();
    m3u.category = "Series";
    m3u.season = this.Season;
    m3u.episode = this.Episode;
    return m3u;
  }
}
