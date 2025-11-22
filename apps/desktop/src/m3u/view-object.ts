import { LucideFolder, LucideIcon } from "lucide-react";
import { GroupObject } from "./group";

export class ViewObject {
  public Name: string = "";
  public Logo: string = "";
  public UpperLevel?: GroupObject;


  public LogoPercent: number = 0.0;

  public isSticky: boolean = false;
  public AddedDate: Date = null!;

  get TitleIcon(): LucideIcon { return LucideFolder; }
  get Title(): string {
    return "Group";
  }
}
