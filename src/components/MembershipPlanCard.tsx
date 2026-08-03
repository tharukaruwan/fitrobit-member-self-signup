
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Users, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

export type Duration = {
  days: number;
  months: number;
  weeks: number;
  years: number;
};

export type Category = {
  name: string;
  order?: number;
};

export type MembershipPlan = {
  _id: string;
  name: string;
  order?: number;
  description: string;
  price: string;
  memberLimit: number;
  duration: Duration;
  benefits: string[];
  tag?: boolean;
  isClass: boolean;
  category?: Category; // TODO: group by category all MembershipPlans
};

interface MembershipPlanCardProps {
  plan: MembershipPlan;
  selected: boolean;
  onSelect: () => void;
  onViewDetails: () => void;
}

function formatDuration(duration: Duration) {
  if (!duration) return "";
  const parts: string[] = [];
  if (duration.years) parts.push(`${duration.years} ${duration.years > 1 ? "Years" : "Year"}`);
  if (duration.months) parts.push(`${duration.months} ${duration.months > 1 ? "Months" : "Month"}`);
  if (duration.weeks) parts.push(`${duration.weeks} ${duration.weeks > 1 ? "Weeks" : "Week"}`);
  if (duration.days) parts.push(`${duration.days} ${duration.days > 1 ? "Days" : "Day"}`);
  return parts.length > 0 ? parts.join(" ") : "No Duration Set";
}

function formatMemberLimit(limit: number) {
  if (!limit || limit <= 0) return "Unlimited";
  return `${limit} ${limit > 1 ? "Members" : "Member"}`;
}

export const MembershipPlanCard = ({ plan, selected, onSelect, onViewDetails }: MembershipPlanCardProps) => {
  const durationText = formatDuration(plan.duration);
  const memberCountText = formatMemberLimit(plan.memberLimit);

  return (
    <Card
      className={cn(
        "relative transition-all duration-200 h-full flex flex-col",
        selected
          ? "border-2 border-primary shadow-lg"
          : "border hover:border-gray-300 hover:shadow-md"
      )}
    >
      {/* Tag Badge */}
      {!!plan.tag && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="bg-primary text-primary-foreground text-xs font-semibold px-4 py-1 rounded-full shadow-sm">
            {plan.tag}
          </span>
        </div>
      )}

      <CardHeader className={cn("text-center border-b bg-muted/30", !!plan.tag && "pt-6")}>
        <CardTitle className="text-xl font-semibold mb-1">{plan.name}</CardTitle>
        <p className="text-sm text-muted-foreground">{plan.description}</p>
      </CardHeader>

      {/* Price Section */}
      {plan.price && <div className="py-8 text-center border-b">
        <div className="flex items-start justify-center gap-1">
          <span className="text-lg font-medium text-muted-foreground mt-2">Rs</span>
          <span className="text-5xl font-bold tracking-tight">{plan.price.toLocaleString()}</span>
        </div>
        <p className="text-sm text-muted-foreground mt-2">{durationText}</p>
      </div>}

      {/* Info Section */}
      <div className="px-6 py-4 bg-muted/20 border-b">
        <div className="flex items-center justify-center gap-6 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>{memberCountText}</span>
          </div>
          {durationText && <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>{durationText}</span>
          </div>}
        </div>
      </div>

      {/* Benefits */}
      {/* <CardContent className="flex-1 pt-6">
        <ul className="space-y-3">
          {plan.benefits.map((benefit, index) => (
            <li key={index} className="flex items-start gap-3">
              <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" strokeWidth={2.5} />
              <span className="text-sm text-foreground/90 leading-relaxed">{benefit}</span>
            </li>
          ))}
        </ul>
      </CardContent> */}

      {/* Actions */}
      <CardFooter className="flex-col gap-2 pt-6 border-t bg-muted/20">
        <Button
          size="lg"
          onClick={(e) => {
            e.stopPropagation();
            onSelect();
          }}
          className={cn(
            "w-full font-semibold",
            selected ? "bg-primary" : ""
          )}
          variant={selected ? "default" : "destructive"}
        >
          {selected ? (
            <>
              <Check className="mr-2 h-4 w-4" />
              Selected
            </>
          ) : (
            "Click to Select"
          )}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onViewDetails();
          }}
          className="w-full text-muted-foreground hover:text-foreground"
        >
          View Full Details
        </Button>
      </CardFooter>
    </Card>
  );
};