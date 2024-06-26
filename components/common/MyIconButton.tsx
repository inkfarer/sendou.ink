import {
  IconButton,
  IconButtonProps,
  Popover,
  PopoverArrow,
  PopoverContent,
  PopoverHeader,
  PopoverTrigger,
} from "@chakra-ui/react";
import { CSSVariables } from "utils/CSSVariables";

interface Props {
  onClick?: () => void;
  icon: React.ReactElement;
  popup: string;
}

const MyIconButton: React.FC<Props & Omit<IconButtonProps, "aria-label">> = ({
  onClick,
  icon,
  popup,
  ...props
}) => {
  return (
    <Popover trigger="hover" variant="responsive">
      <PopoverTrigger>
        <IconButton
          variant="ghost"
          isRound
          onClick={onClick}
          aria-label={popup}
          icon={icon}
          {...props}
        />
      </PopoverTrigger>
      <PopoverContent bg={CSSVariables.secondaryBgColor}>
        <PopoverHeader fontWeight="semibold">{popup}</PopoverHeader>
        <PopoverArrow bg={CSSVariables.secondaryBgColor} />
      </PopoverContent>
    </Popover>
  );
};

export default MyIconButton;
