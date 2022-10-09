import type { ActionFunction, LinksFunction } from "@remix-run/node";
import { useTranslation } from "react-i18next";
import { Image } from "~/components/Image";
import { Main } from "~/components/Main";
import {
  modesShort,
  type ModeShort,
  type ModeWithStage,
  type StageId,
} from "~/modules/in-game-lists";
import { modes, stageIds } from "~/modules/in-game-lists";
import type { MapPool } from "~/modules/map-pool-serializer/types";
import styles from "~/styles/maps.css";
import { modeImageUrl, stageImageUrl } from "~/utils/urls";
import clsx from "clsx";
import { Form, useSearchParams } from "@remix-run/react";
import {
  mapPoolToSerializedString,
  serializedStringToMapPool,
} from "~/modules/map-pool-serializer";
import { requireUser, useUser } from "~/modules/auth";
import { ADMIN_DISCORD_ID, MAPS } from "~/constants";
import { Button } from "~/components/Button";
import { Input } from "~/components/Input";
import { Label } from "~/components/Label";
import { DownloadIcon } from "~/components/icons/Download";
import { Toggle } from "~/components/Toggle";
import {
  generateMapList,
  mapPoolToNonEmptyModes,
  modesOrder,
} from "~/modules/map-list-generator";
import * as React from "react";
import invariant from "tiny-invariant";
import { z } from "zod";
import { parseRequestFormData } from "~/utils/remix";
import { db } from "~/db";

const AMOUNT_OF_MAPS_IN_MAP_LIST = stageIds.length * 2;

export const links: LinksFunction = () => {
  return [{ rel: "stylesheet", href: styles }];
};

export const handle = {
  i18n: "game-misc",
};

// xxx: next -> define user flow after submitting a map pool
const mapsActionSchema = z.object({
  code: z.string().min(MAPS.CODE_MIN_LENGTH).max(MAPS.CODE_MAX_LENGTH),
  pool: z.string(),
});

export const action: ActionFunction = async ({ request }) => {
  const user = await requireUser(request);
  const data = await parseRequestFormData({
    request,
    schema: mapsActionSchema,
  });

  const mapPool = serializedStringToMapPool(data.pool);
  const maps = Object.entries(mapPool).flatMap(([mode, stages]) =>
    stages.flatMap((stageId) => ({ mode: mode as ModeShort, stageId }))
  );

  db.maps.addMapPool({
    ownerId: user.id,
    code: data.code,
    maps,
  });

  return null;
};

const DEFAULT_MAP_POOL = {
  SZ: [...stageIds],
  TC: [...stageIds],
  CB: [...stageIds],
  RM: [...stageIds],
  TW: [],
};

export default function MapListPage() {
  const { mapPool, handleMapPoolChange } = useSearchParamMapPool();

  return (
    <Main className="maps__container stack lg">
      <MapPoolLoaderSaver mapPool={mapPool} />
      <MapPoolSelector
        mapPool={mapPool}
        handleMapPoolChange={handleMapPoolChange}
      />
      <MapListCreator mapPool={mapPool} />
    </Main>
  );
}

function useSearchParamMapPool() {
  const [searchParams, setSearchParams] = useSearchParams();
  const mapPool = searchParams.has("pool")
    ? serializedStringToMapPool(searchParams.get("pool")!)
    : DEFAULT_MAP_POOL;

  const handleMapPoolChange = ({
    mode,
    stageId,
  }: {
    mode: ModeShort;
    stageId: StageId;
  }) => {
    const newMapPool = mapPool[mode].includes(stageId)
      ? {
          ...mapPool,
          [mode]: mapPool[mode].filter((id) => id !== stageId),
        }
      : {
          ...mapPool,
          [mode]: [...mapPool[mode], stageId],
        };

    setSearchParams(
      {
        pool: mapPoolToSerializedString(newMapPool),
      },
      { replace: true, state: { scroll: false } }
    );
  };

  return {
    mapPool,
    handleMapPoolChange,
  };
}

function MapPoolSelector({
  mapPool,
  handleMapPoolChange,
}: {
  mapPool: MapPool;
  handleMapPoolChange: (args: { mode: ModeShort; stageId: StageId }) => void;
}) {
  const user = useUser();
  const { t } = useTranslation(["game-misc"]);

  if (
    process.env.NODE_ENV !== "development" &&
    user?.discordId !== ADMIN_DISCORD_ID
  ) {
    return <Main>Coming soon :)</Main>;
  }

  return (
    <div className="stack md">
      {stageIds.map((stageId) => (
        <div key={stageId} className="maps__stage-row">
          <Image
            className="maps__stage-image"
            alt=""
            path={stageImageUrl(stageId)}
            width={80}
            height={45}
          />
          <div className="maps__stage-name-row">
            <div>{t(`game-misc:STAGE_${stageId}`)}</div>
            <div className="maps__mode-buttons-container">
              {modes.map((mode) => {
                const selected = mapPool[mode.short].includes(stageId);

                return (
                  <button
                    key={mode.short}
                    className={clsx("maps__mode-button", "outline-theme", {
                      selected,
                    })}
                    onClick={() =>
                      handleMapPoolChange({ mode: mode.short, stageId })
                    }
                    type="button"
                  >
                    <Image
                      className={clsx("maps__mode", {
                        selected,
                      })}
                      alt={mode.long}
                      path={modeImageUrl(mode.short)}
                      width={20}
                      height={20}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// xxx: show "log in to save map pools" if not logged in
function MapPoolLoaderSaver({ mapPool }: { mapPool: MapPool }) {
  const hasChanges = (() => {
    for (const mode of modesShort) {
      if (mapPool[mode].length !== DEFAULT_MAP_POOL[mode].length) {
        return true;
      }

      for (const stageId of mapPool[mode]) {
        if (!(DEFAULT_MAP_POOL[mode] as StageId[]).includes(stageId)) {
          return true;
        }
      }
    }

    return false;
  })();

  return (
    <Form
      className="maps__pool-loader-saver"
      method={hasChanges ? "post" : "get"}
    >
      <input
        type="hidden"
        name="pool"
        value={mapPoolToSerializedString(mapPool)}
      />
      <div>
        <Label>Code</Label>
        <Input
          name="code"
          minLength={MAPS.CODE_MIN_LENGTH}
          maxLength={MAPS.CODE_MAX_LENGTH}
        />
      </div>
      <Button icon={<DownloadIcon />} variant="outlined" type="submit">
        {hasChanges ? "Save map pool" : "Load map pool"}
      </Button>
    </Form>
  );
}

// xxx: crashes if only one map in mode
// xxx: presentational mode
function MapListCreator({ mapPool }: { mapPool: MapPool }) {
  const { t } = useTranslation(["game-misc"]);
  const [mapList, setMapList] = React.useState<ModeWithStage[]>();
  const [szEveryOther, setSzEveryOther] = React.useState(false);

  const handleCreateMaplist = () => {
    const [list] = generateMapList(
      mapPool,
      modesOrder(
        szEveryOther ? "SZ_EVERY_OTHER" : "EQUAL",
        mapPoolToNonEmptyModes(mapPool)
      ),
      [AMOUNT_OF_MAPS_IN_MAP_LIST]
    );

    invariant(list);

    setMapList(list);
  };

  return (
    <div className="maps__map-list-creator">
      <div className="maps__toggle-container">
        <Label>50% SZ</Label>
        <Toggle checked={szEveryOther} setChecked={setSzEveryOther} tiny />
      </div>
      <Button onClick={handleCreateMaplist}>Create map list</Button>
      {mapList && (
        <ol className="maps__map-list">
          {mapList.map(({ mode, stageId }, i) => (
            <li key={i}>
              {t(`game-misc:MODE_SHORT_${mode}`)}{" "}
              {t(`game-misc:STAGE_${stageId}`)}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
