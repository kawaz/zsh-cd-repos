# zsh-cd-repos

fzf を使って `$XDG_DATA_HOME/repos/` 配下の git/jj リポジトリに素早く cd するための zsh プラグイン。

## 特徴

- `^s` でリポジトリ一覧を fzf で表示し、選択したリポジトリに cd
- BUFFER にテキストが入力されていれば、それをクエリとして絞り込み
- git リポジトリと jj リポジトリの両方に対応
- プレビューでブランチ情報やログを表示
- 既存の `^s` バインドがある場合は widget チェインで共存

## インストール

### 手動

```bash
git clone https://github.com/kawaz/zsh-cd-repos.git ~/.zsh/zsh-cd-repos
echo 'source ~/.zsh/zsh-cd-repos/zsh-cd-repos.plugin.zsh' >> ~/.zshrc
```

### zinit

```zsh
zinit light kawaz/zsh-cd-repos
```

### sheldon

`~/.config/sheldon/plugins.toml` に追加:

```toml
[plugins.zsh-cd-repos]
github = "kawaz/zsh-cd-repos"
```

### Nix home-manager

```nix
programs.zsh.plugins = [
  {
    name = "zsh-cd-repos";
    src = pkgs.fetchFromGitHub {
      owner = "kawaz";
      repo = "zsh-cd-repos";
      rev = "main";
      hash = ""; # nix build 時に正しいハッシュに置き換えてください
    };
  }
];
```

## 使い方

1. `^s` (Ctrl+s) を押すとリポジトリ一覧が fzf で表示されます
2. コマンドラインにテキストを入力してから `^s` を押すと、そのテキストでリポジトリを絞り込みます
3. リポジトリを選択すると `cd <選択したパス>` がコマンドラインにセットされます

## 依存

- [fzf](https://github.com/junegunn/fzf)
- bash

## ライセンス

MIT License - Yoshiaki Kawazu (@kawaz)
