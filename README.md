# Pocket VS Code Helper

Extension VS Code de bien file `.bat` cu cua Omni Reup Video thanh nut bam trong VS Code.

## Cai vao VS Code de dung truc tiep

Chay trong folder nay:

```powershell
npm install
npm run install:local
```

Sau do reload VS Code hoac dong/mo lai VS Code.

Tu luc nay, khi mo project nay hoac project `omni-reup-video`, thanh Status Bar ben trai se co cac nut:

- `Omni Helper`: don cache/runtime files, roi hoi Pull, Commit & Push, hoac Skip.
- `Move Cache`: chi don cache/runtime files vao `../omni-reup-video-cache-backups/<timestamp>`.
- `Pull`: chay `git pull --ff-only --autostash`.
- `Push`: chay `git push`.
- `Commit & Push`: hoi commit message, roi chay `git add -A`, commit, `git pull --rebase --autostash`, va `git push`.

Ban cung co the bam `Ctrl+Shift+P`, go `Omni` de chay lenh.

## Vi tri nut

- Status Bar ben trai: day la cho tien nhat de bam nhanh.
- Explorer title bar: co nut `Move Cache + Git`.
- Source Control title bar: co nut `Pull`, `Push`, va `Commit & Push`.

## Chay thu khi dang dev

Neu muon debug extension:

```powershell
npm install
npm run compile
```

Roi bam `F5` trong VS Code.

## An toan

Buoc don cache chi move cac path nam trong workspace dang mo va backup vao folder cha:

```text
../omni-reup-video-cache-backups/<yyyyMMdd-HHmmss>
```
