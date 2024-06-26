#!/usr/bin/env bash
exit

## ----------------------------------------------------------------------------------
## init script
cd "$(dirname "$0")/../../" || exit 1

if [[ "$(command -v realpath)" != "" ]]; then
  ROOT_DIR="$(realpath "$PWD")"
else
  ROOT_DIR="$PWD"
fi

source "$(dirname "$0")/../includes.sh"

## ----------------------------------------------------------------------------------
## macaddress
MACADDRESS_STORE_FILE="$ROOT_DIR/data/macaddress.data"
DEFAULT_MACADDRESS="00:08:dc:01:02:03"

function store_macaddress() {
  local CURRENT_MACADDRESS="$1"

  sudo rm -rf "$MACADDRESS_STORE_FILE"
  echo "$CURRENT_MACADDRESS" > "$MACADDRESS_STORE_FILE"

  echo ">>>>>>>>> MAC-Address value stored in file: $CURRENT_MACADDRESS"
}

## ----------------------------------------------------------------------------------
## install tools if missing
if [[ "$(command -v ifconfig)" == "" ]]; then
  echo ">>>>>>>>> Installing net-tools ..."
  sudo apt-get -y install net-tools
fi

## ----------------------------------------------------------------------------------
## update macaddress
CURRENT_MACADDRESS="$(get_macaddress)"
echo ">>>>>>>>> Current MAC-Address value: $CURRENT_MACADDRESS"

if [[ \
  "$CURRENT_MACADDRESS" != "$DEFAULT_MACADDRESS" && \
  "$CURRENT_MACADDRESS" != "" \
]]; then
  echo ">>>>>>>>> An valid MAC-Address already set, value: $CURRENT_MACADDRESS"
  exit 0
fi

NEW_MACADDRES_VALUE=""
if [[ -f "$MACADDRESS_STORE_FILE" ]]; then
  echo ">>>>>>>>> Getting previously saved MAC-Address form file ..."
  NEW_MACADDRES_VALUE="$(cat "$MACADDRESS_STORE_FILE")"
  echo ">>>>>>>>> MAC-Address value from stored file \"$NEW_MACADDRES_VALUE\""
fi

if [[ \
  "$NEW_MACADDRES_VALUE" == "$DEFAULT_MACADDRESS" || \
  "$NEW_MACADDRES_VALUE" == "" \
]]; then
  echo ">>>>>>>>> Generating new MAC-Address ..."
  # NEW_MACADDRES_VALUE="$(\
  #   printf '%02x:%02x:%02x:%02x:%02x:%02x\n' \
  #     "$[RANDOM%255]" "$[RANDOM%255]" "$[RANDOM%255]" \
  #     "$[RANDOM%255]" "$[RANDOM%255]" "$[RANDOM%255]" \
  # )"
  NEW_MACADDRES_VALUE="$(\
    printf '02:00:00:%02x:%02x:%02x\n' \
      "$[RANDOM%255]" "$[RANDOM%255]" "$[RANDOM%255]" \
  )"
fi
echo ">>>>>>>>> MAC-Address value will be \"$NEW_MACADDRES_VALUE\""

echo ">>>>>>>>> Putting network network: down"
sudo ifconfig "$NETWORK_INTERFACE" "down"

echo ">>>>>>>>> Setting new MAC-Address ..."
sudo ifconfig "$NETWORK_INTERFACE" hw ether "$NEW_MACADDRES_VALUE"

echo ">>>>>>>>> Putting network network: up"
sudo ifconfig "$NETWORK_INTERFACE" "up"

store_macaddress "$NEW_MACADDRES_VALUE"
