import { Form, useLoaderData } from "@remix-run/react";
import { Label } from "~/components/Label";
import { Main } from "~/components/Main";
import * as React from "react";
import type {
  Badge as BadgeType,
  CalendarEvent,
  CalendarEventTag,
} from "~/db/types";
import {
  CALENDAR_EVENT_BRACKET_URL_MAX_LENGTH,
  CALENDAR_EVENT_DESCRIPTION_MAX_LENGTH,
  CALENDAR_EVENT_DISCORD_INVITE_CODE_MAX_LENGTH,
  CALENDAR_EVENT_MAX_AMOUNT_OF_DATES,
  CALENDAR_EVENT_NAME_MAX_LENGTH,
  CALENDAR_EVENT_NAME_MIN_LENGTH,
} from "~/constants";
import { Button } from "~/components/Button";
import {
  json,
  redirect,
  type ActionFunction,
  type LinksFunction,
  type LoaderArgs,
} from "@remix-run/node";
import styles from "~/styles/calendar-new.css";
import clsx from "clsx";
import { useTranslation } from "react-i18next";
import { TrashIcon } from "~/components/icons/Trash";
import { Input } from "~/components/Input";
import { FormMessage } from "~/components/FormMessage";
import { useIsMounted } from "~/hooks/useIsMounted";
import allTags from "./tags.json";
import { Tags } from "./components/Tags";
import { db } from "~/db";
import { requireUser } from "~/modules/auth";
import { Badge } from "~/components/Badge";
import { z } from "zod";
import {
  date,
  falsyToNull,
  id,
  processMany,
  removeDuplicates,
  safeJSONParse,
} from "~/utils/zod";
import { parseRequestFormData } from "~/utils/remix";
import {
  dateToDatabaseTimestamp,
  dateToYearMonthDayHourMinuteString,
} from "~/utils/dates";
import { calendarEventPage } from "~/utils/urls";

const MIN_DATE = new Date(Date.UTC(2015, 4, 28));

const MAX_DATE = new Date();
MAX_DATE.setFullYear(MAX_DATE.getFullYear() + 1);

export const links: LinksFunction = () => {
  return [{ rel: "stylesheet", href: styles }];
};

const newCalendarEventActionSchema = z.object({
  name: z
    .string()
    .min(CALENDAR_EVENT_NAME_MIN_LENGTH)
    .max(CALENDAR_EVENT_NAME_MAX_LENGTH),
  description: z.preprocess(
    falsyToNull,
    z.string().max(CALENDAR_EVENT_DESCRIPTION_MAX_LENGTH).nullable()
  ),
  dates: z.preprocess(
    safeJSONParse,
    z
      .array(z.preprocess(date, z.date().min(MIN_DATE).max(MAX_DATE)))
      .min(1)
      .max(CALENDAR_EVENT_MAX_AMOUNT_OF_DATES)
  ),
  bracketUrl: z.string().url().max(CALENDAR_EVENT_BRACKET_URL_MAX_LENGTH),
  discordInviteCode: z.preprocess(
    falsyToNull,
    z.string().max(CALENDAR_EVENT_DISCORD_INVITE_CODE_MAX_LENGTH).nullable()
  ),
  tags: z.preprocess(
    processMany(safeJSONParse, removeDuplicates),
    z
      .array(z.string().refine((val) => Object.keys(allTags).includes(val)))
      .nullable()
  ),
  badges: z.preprocess(
    processMany(safeJSONParse, removeDuplicates),
    z.array(id).nullable()
  ),
});

export const action: ActionFunction = async ({ request }) => {
  const user = await requireUser(request);
  const data = await parseRequestFormData({
    request,
    schema: newCalendarEventActionSchema,
  });

  const createdEventId = db.calendarEvents.create({
    authorId: user.id,
    name: data.name,
    description: data.description,
    startTimes: data.dates.map((date) => dateToDatabaseTimestamp(date)),
    bracketUrl: data.bracketUrl,
    discordInviteCode: data.discordInviteCode,
    tags: data.tags ? data.tags.join(",") : data.tags,
    badges: data.badges ?? [],
  });

  return redirect(calendarEventPage(createdEventId));
};

export const handle = {
  i18n: "calendar",
};

export const loader = async ({ request }: LoaderArgs) => {
  const user = await requireUser(request);

  return json({
    managedBadges: db.badges.managedByUserId(user.id),
  });
};

export default function CalendarNewEventPage() {
  return (
    <Main halfWidth>
      <Form className="stack md items-start" method="post">
        <NameInput />
        <DescriptionTextarea />
        <DatesInput />
        <BracketUrlInput />
        <DiscordLinkInput />
        <TagsAdder />
        <BadgesAdder />
        <Button type="submit" className="mt-4">
          Submit
        </Button>
      </Form>
    </Main>
  );
}

function NameInput() {
  return (
    <div>
      <Label htmlFor="name" required>
        Name
      </Label>
      <input
        name="name"
        required
        minLength={CALENDAR_EVENT_NAME_MIN_LENGTH}
        maxLength={CALENDAR_EVENT_NAME_MAX_LENGTH}
      />
    </div>
  );
}

function DescriptionTextarea({
  initialValue,
}: {
  initialValue?: CalendarEvent["description"];
}) {
  const [value, setValue] = React.useState(initialValue ?? "");

  return (
    <div>
      <Label
        htmlFor="description"
        valueLimits={{
          current: value.length,
          max: CALENDAR_EVENT_DESCRIPTION_MAX_LENGTH,
        }}
      >
        Description
      </Label>
      <textarea
        id="description"
        name="description"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        maxLength={CALENDAR_EVENT_DESCRIPTION_MAX_LENGTH}
      />
    </div>
  );
}

function DatesInput() {
  const { i18n } = useTranslation();
  const [dateInputValue, setDateInputValue] = React.useState<string>();
  const [dates, setDates] = React.useState<{ date: Date; id: string }[]>([]);
  const isMounted = useIsMounted();

  const usersTimeZone = isMounted
    ? Intl.DateTimeFormat().resolvedOptions().timeZone
    : "";

  return (
    <div className="stack md items-start">
      {dates.length > 0 && (
        <input
          type="hidden"
          name="dates"
          value={JSON.stringify(dates.map(({ date }) => date.getTime()))}
        />
      )}
      <div>
        <Label htmlFor="date" required>
          Dates
        </Label>
        <div className="stack horizontal sm items-center">
          <input
            id="date"
            type="datetime-local"
            value={dateInputValue ?? ""}
            onChange={(e) => setDateInputValue(e.target.value)}
            min={dateToYearMonthDayHourMinuteString(MIN_DATE)}
            max={dateToYearMonthDayHourMinuteString(MAX_DATE)}
          />
          <Button
            tiny
            disabled={!dateInputValue}
            onClick={() => {
              setDates(
                [
                  ...dates,
                  {
                    date: new Date(dateInputValue!),
                    id: String(Math.random()),
                  },
                ].sort((a, b) => a.date.getTime() - b.date.getTime())
              );
            }}
          >
            Add date
          </Button>
        </div>
        <FormMessage type="info" className={clsx({ invisible: !isMounted })}>
          Times in your local time zone: {usersTimeZone}
        </FormMessage>
      </div>
      {dates.length > 0 && (
        <div className="calendar-new__dates-list">
          {dates.map(({ date, id }, i) => (
            <React.Fragment key={id}>
              <div
                className={clsx("text-lighter", { hidden: dates.length === 1 })}
              >
                Day {i + 1}
              </div>
              <div>
                {date.toLocaleTimeString(i18n.language, {
                  hour: "numeric",
                  minute: "numeric",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  weekday: "long",
                })}
              </div>
              <Button
                onClick={() => setDates(dates.filter((date) => date.id !== id))}
                className="mr-auto"
                icon={<TrashIcon />}
                variant="minimal-destructive"
                aria-label="Remove date"
              />
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
}

function DiscordLinkInput() {
  return (
    <div className="stack items-start">
      <Label htmlFor="discordInviteCode">Discord server invite URL</Label>
      <Input
        name="discordInviteCode"
        leftAddon="https://discord.gg/"
        maxLength={CALENDAR_EVENT_DISCORD_INVITE_CODE_MAX_LENGTH}
      />
    </div>
  );
}

function BracketUrlInput() {
  return (
    <div>
      <Label htmlFor="bracketUrl" required>
        Bracket URL
      </Label>
      <input
        name="bracketUrl"
        type="url"
        required
        maxLength={CALENDAR_EVENT_BRACKET_URL_MAX_LENGTH}
      />
    </div>
  );
}

function TagsAdder() {
  const { t } = useTranslation("calendar");
  const [tags, setTags] = React.useState<CalendarEventTag[]>([]);
  const id = React.useId();

  const tagsForSelect = (
    Object.keys(allTags) as Array<CalendarEventTag>
  ).filter((tag) => !tags.includes(tag));

  return (
    <div className="stack sm">
      <input
        type="hidden"
        name="tags"
        value={JSON.stringify(tags.length > 0 ? tags : null)}
      />
      <div>
        <label htmlFor={id}>Tags</label>
        <select
          id={id}
          className="calendar-new__select"
          onChange={(e) =>
            setTags([...tags, e.target.value as CalendarEventTag])
          }
        >
          <option value="">Choose a tag</option>
          {tagsForSelect.map((tag) => (
            <option key={tag} value={tag}>
              {t(`tag.name.${tag}`)}
            </option>
          ))}
        </select>
        <FormMessage type="info">
          &quot;Badge prizes&quot; tag is added automatically if applicable
        </FormMessage>
      </div>
      <Tags tags={tags} />
    </div>
  );
}

function BadgesAdder() {
  const { managedBadges } = useLoaderData<typeof loader>();
  const [badges, setBadges] = React.useState<BadgeType[]>([]);
  const id = React.useId();

  if (managedBadges.length === 0) return null;

  const handleBadgeDelete = (badgeId: BadgeType["id"]) => {
    setBadges(badges.filter((badge) => badge.id !== badgeId));
  };

  const badgesForSelect = managedBadges.filter(
    (badge) => !badges.some((b) => b.id === badge.id)
  );

  return (
    <div className="stack md">
      <input
        type="hidden"
        name="badges"
        value={JSON.stringify(
          badges.length > 0 ? badges.map((b) => b.id) : null
        )}
      />
      <div>
        <label htmlFor={id}>Badge prizes</label>
        <select
          id={id}
          className="calendar-new__select"
          onChange={(e) => {
            setBadges([
              ...badges,
              managedBadges.find(
                (badge) => badge.id === Number(e.target.value)
              )!,
            ]);
          }}
        >
          <option value="">Choose a badge prize</option>
          {badgesForSelect.map((badge) => (
            <option key={badge.id} value={badge.id}>
              {badge.displayName}
            </option>
          ))}
        </select>
      </div>
      {badges.length > 0 && (
        <div className="calendar-new__badges">
          {badges.map((badge) => (
            <div className="stack horizontal md items-center" key={badge.id}>
              <Badge badge={badge} isAnimated size={32} />
              <span>{badge.displayName}</span>
              <Button
                className="ml-auto"
                onClick={() => handleBadgeDelete(badge.id)}
                icon={<TrashIcon />}
                variant="minimal-destructive"
                aria-label="Remove badge"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
