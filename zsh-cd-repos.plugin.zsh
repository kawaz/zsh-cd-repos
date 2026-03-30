# zsh-cd-repos: Quickly cd to git/jj repositories with fzf
#
# Usage:
#   1. source this plugin
#   2. Press ^s to fuzzy-search repositories and cd into the selected one
#   3. Type a query first, then press ^s to pre-filter

[[ -o interactive ]] || return 0

typeset -g _cd_repos_cmd="${0:h}/bin/cd-repos"

cd-repos() {
  local d
  d=$("$_cd_repos_cmd" search "$BUFFER")
  if [[ -n $d ]]; then
    BUFFER="cd ${(q)d}"
    CURSOR=${#BUFFER}
  fi
  zle reset-prompt
}
zle -N cd-repos
bindkey '^s' cd-repos
