# AUR package — `voxelxlauncher-bin`

Gói AUR cài VoxelXLauncher trên Arch Linux (và các distro nền Arch như Manjaro,
EndeavourOS) bằng cách tải **AppImage** từ GitHub Release, giải nén và cài vào
`/opt`.

## Cài đặt

```sh
yay -S voxelxlauncher-bin
# hoặc
paru -S voxelxlauncher-bin
```

Sau khi cài, chạy bằng lệnh `voxelxlauncher` hoặc mở từ menu ứng dụng.

## Cách hoạt động

- `source` trỏ tới `…/releases/download/v$pkgver/VoxelXLauncher-$pkgver.AppImage`.
- `prepare()` giải nén AppImage (`--appimage-extract`).
- `package()` copy payload vào `/opt/voxelxlauncher-bin`, tạo wrapper
  `/usr/bin/voxelxlauncher`, cài `.desktop` + icon, và set SUID cho
  `chrome-sandbox` (cần cho Electron sandbox).

## Phát hành lên AUR

### Tự động (khuyến nghị)
Job `publish-aur` trong `.github/workflows/build-release.yml` tự động:
1. Cập nhật `pkgver` theo tag.
2. Tính lại `sha256sums` từ AppImage vừa release (`updpkgsums`).
3. Sinh `.SRCINFO` và push lên `ssh://aur@aur.archlinux.org/voxelxlauncher-bin.git`.

**Yêu cầu một lần:**
- Tạo SSH key, thêm public key vào tài khoản AUR (https://aur.archlinux.org → My Account).
- Thêm private key vào GitHub repo secret tên **`AUR_SSH_PRIVATE_KEY`**.
- Lần đầu tên gói `voxelxlauncher-bin` sẽ được tạo tự động khi push (nếu tên còn trống).

### Thủ công
```sh
git clone ssh://aur@aur.archlinux.org/voxelxlauncher-bin.git
cd voxelxlauncher-bin
cp /đường/dẫn/packaging/aur/PKGBUILD .
updpkgsums                     # cập nhật sha256sums
makepkg --printsrcinfo > .SRCINFO
git add PKGBUILD .SRCINFO
git commit -m "Update to <version>"
git push
```

## Kiểm thử cục bộ

```sh
cd packaging/aur
updpkgsums          # cần AppImage đã release sẵn cho pkgver hiện tại
makepkg -si
```
