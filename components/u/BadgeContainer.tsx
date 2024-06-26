import { Image as ChakraImage } from "@chakra-ui/image";
import { Box, Flex, Text } from "@chakra-ui/react";
import { useState } from "react";
import { CSSVariables } from "utils/CSSVariables";

const BadgeContainer = ({
  showInfo,
  showBadges,
  badges,
}: {
  showInfo?: boolean;
  showBadges: boolean;
  badges: {
    src: string;
    description: string;
    hueRotateAngle?: number;
    count: number;
  }[];
}) => {
  const [badgeInfoShown, setBadgeInfoShown] = useState("");
  return (
    <>
      <Flex
        flexDir={showInfo ? "column" : "row"}
        flexWrap="wrap"
        justify="center"
        color="white"
        rounded="lg"
        mx="auto"
        mt={2}
      >
        {showBadges &&
          badges.flatMap((badge) => {
            if (showInfo)
              return (
                <Flex my={2} key={badge.src} align="center">
                  <Box background="black" borderRadius="5px">
                    <ChakraImage
                      w={10}
                      h={10}
                      m={1}
                      src={`/badges/${badge.src}`}
                      filter={
                        typeof badge.hueRotateAngle === "number"
                          ? `hue-rotate(${badge.hueRotateAngle}deg)`
                          : undefined
                      }
                    />
                  </Box>{" "}
                  <Text ml={4} fontSize="sm" color={CSSVariables.textColor}>
                    {badge.description}
                  </Text>
                </Flex>
              );
            return (
              <Box
                key={badge.src}
                background="black"
                borderRadius="5px"
                m={3}
                onMouseEnter={() => setBadgeInfoShown(`${badge.description}`)}
                onClick={() => setBadgeInfoShown(`${badge.description}`)}
              >
                <ChakraImage
                  key={`${badge.src}`}
                  w={10}
                  h={10}
                  m={1}
                  src={`/badges/${badge.src}`}
                  filter={
                    typeof badge.hueRotateAngle === "number"
                      ? `hue-rotate(${badge.hueRotateAngle}deg)`
                      : undefined
                  }
                />
                <Text
                  style={{
                    marginTop: -58,
                    marginLeft: 40,
                    fontSize: badge.count > 9 ? "0.5rem" : "0.7rem",
                    fontWeight: "bold",
                    color: CSSVariables.themeColor,
                  }}
                  display={badge.count === 1 ? "none" : "block"}
                  position="absolute"
                  background="black"
                  borderRadius="50%"
                  padding={1}
                  width="23px"
                  height="23px"
                  textAlign="center"
                >
                  {`x${badge.count}`}
                </Text>
              </Box>
            );
          })}
      </Flex>
      <Box
        fontSize="sm"
        textAlign="center"
        color={CSSVariables.themeGray}
        visibility={badgeInfoShown ? "visible" : "hidden"}
      >
        {badgeInfoShown || "Placeholder"}
      </Box>
    </>
  );
};

export default BadgeContainer;
