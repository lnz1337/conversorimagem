#!/usr/bin/env python3
"""
Conversor de Imagens em Massa
Aplicativo desktop com interface gráfica moderna para conversão em lote de imagens.
Suporta: WebP, AVIF, JPEG, JPG, PNG, JFIF, BMP, TIFF
"""

import os
import sys
import threading
import time
from pathlib import Path
from datetime import datetime

import ttkbootstrap as ttk
from ttkbootstrap.constants import *
from ttkbootstrap.scrolled import ScrolledText
from ttkbootstrap.tooltip import ToolTip
from tkinter import filedialog, messagebox
import tkinter as tk

from PIL import Image

# Habilitar suporte AVIF via plugin
try:
    import pillow_avif  # noqa: F401
    AVIF_SUPPORTED = True
except ImportError:
    AVIF_SUPPORTED = False

# Tentar importar tkinterdnd2 para drag-and-drop nativo
try:
    from tkinterdnd2 import DND_FILES, TkinterDnD
    DND_AVAILABLE = True
except ImportError:
    DND_AVAILABLE = False

# ---------------------------------------------------------------------------
# Constantes
# ---------------------------------------------------------------------------

SUPPORTED_INPUT_EXTENSIONS = {
    ".webp", ".avif", ".jpeg", ".jpg", ".png", ".jfif",
    ".bmp", ".tiff", ".tif", ".gif",
}

OUTPUT_FORMATS = ["WebP", "AVIF", "JPEG", "JPG", "PNG", "JFIF", "BMP", "TIFF"]

FORMAT_EXTENSION_MAP = {
    "WebP": ".webp",
    "AVIF": ".avif",
    "JPEG": ".jpeg",
    "JPG": ".jpg",
    "PNG": ".png",
    "JFIF": ".jfif",
    "BMP": ".bmp",
    "TIFF": ".tiff",
}

# Mapeamento de extensão -> formato Pillow para salvamento
PILLOW_SAVE_FORMAT = {
    ".webp": "WEBP",
    ".avif": "AVIF",
    ".jpeg": "JPEG",
    ".jpg": "JPEG",
    ".png": "PNG",
    ".jfif": "JPEG",
    ".bmp": "BMP",
    ".tiff": "TIFF",
}

# Símbolos unicode para ícones simples
ICON_ADD = "\u2795"       # ➕
ICON_REMOVE = "\u2796"    # ➖
ICON_CLEAR = "\u2716"     # ✖
ICON_FOLDER = "\U0001F4C1"  # 📁
ICON_CONVERT = "\u26A1"   # ⚡
ICON_THEME = "\U0001F313"  # 🌓
ICON_CHECK = "\u2714"     # ✔
ICON_ERROR = "\u2718"     # ✘
ICON_IMG = "\U0001F5BC"   # 🖼


# ---------------------------------------------------------------------------
# Motor de conversão
# ---------------------------------------------------------------------------

def detect_format(filepath: str) -> str:
    """Detecta o formato real da imagem usando Pillow."""
    try:
        with Image.open(filepath) as img:
            fmt = img.format
            return fmt if fmt else "Desconhecido"
    except Exception:
        return "Desconhecido"


def convert_image(
    src_path: str,
    dst_folder: str,
    target_format: str,
    quality: int = 90,
) -> tuple[bool, str]:
    """
    Converte uma imagem para o formato de destino.
    Retorna (sucesso: bool, mensagem: str).
    """
    try:
        ext = FORMAT_EXTENSION_MAP[target_format]
        pillow_fmt = PILLOW_SAVE_FORMAT[ext]

        if pillow_fmt == "AVIF" and not AVIF_SUPPORTED:
            return False, "Formato AVIF não disponível (instale pillow-avif-plugin)"

        src = Path(src_path)
        dst_name = src.stem + ext
        dst_path = Path(dst_folder) / dst_name

        # Evitar sobrescrever: adiciona sufixo numérico
        counter = 1
        while dst_path.exists():
            dst_name = f"{src.stem}_{counter}{ext}"
            dst_path = Path(dst_folder) / dst_name
            counter += 1

        with Image.open(src_path) as img:
            # Converter RGBA -> RGB para formatos que não suportam transparência
            if img.mode == "RGBA" and pillow_fmt in ("JPEG", "BMP"):
                bg = Image.new("RGB", img.size, (255, 255, 255))
                bg.paste(img, mask=img.split()[3])
                img = bg
            elif img.mode == "P" and pillow_fmt in ("JPEG", "BMP"):
                img = img.convert("RGB")
            elif img.mode not in ("RGB", "RGBA", "L"):
                img = img.convert("RGB")

            save_kwargs = {}
            if pillow_fmt in ("JPEG", "WEBP", "AVIF"):
                save_kwargs["quality"] = quality
            if pillow_fmt == "TIFF":
                save_kwargs["compression"] = "tiff_deflate"

            img.save(str(dst_path), format=pillow_fmt, **save_kwargs)

        return True, f"{ICON_CHECK} {src.name} → {dst_name}"

    except Exception as e:
        return False, f"{ICON_ERROR} {Path(src_path).name}: {e}"


# ---------------------------------------------------------------------------
# Aplicação GUI
# ---------------------------------------------------------------------------

class ImageConverterApp:
    """Aplicação principal do conversor de imagens."""

    DARK_THEME = "darkly"
    LIGHT_THEME = "cosmo"

    def __init__(self):
        # Criar janela raiz (com ou sem DnD)
        if DND_AVAILABLE:
            self.root = TkinterDnD.Tk()
        else:
            self.root = tk.Tk()

        self.style = ttk.Style(self.DARK_THEME)
        self.root.title("Conversor de Imagens em Massa")
        self.root.geometry("960x720")
        self.root.minsize(800, 600)

        self.current_theme = self.DARK_THEME
        self.image_files: list[dict] = []  # [{path, name, format, size}]
        self.output_folder: str = ""
        self.is_converting = False

        self._build_ui()
        self._center_window()

    # ----- Layout -----

    def _build_ui(self):
        """Constrói toda a interface gráfica."""
        # Frame principal com padding
        self.main_frame = ttk.Frame(self.root, padding=10)
        self.main_frame.pack(fill=BOTH, expand=YES)

        self._build_header()
        self._build_drop_zone()
        self._build_file_list()
        self._build_options_bar()
        self._build_progress_section()
        self._build_log_section()

    def _build_header(self):
        """Cabeçalho com título e botão de tema."""
        header = ttk.Frame(self.main_frame)
        header.pack(fill=X, pady=(0, 10))

        title = ttk.Label(
            header,
            text=f"{ICON_IMG}  Conversor de Imagens em Massa",
            font=("-size", 18, "-weight", "bold"),
            bootstyle="inverse-primary",
            padding=(15, 8),
        )
        title.pack(side=LEFT, fill=X, expand=YES)

        self.theme_btn = ttk.Button(
            header,
            text=f"{ICON_THEME} Tema",
            bootstyle="outline",
            command=self._toggle_theme,
            width=12,
        )
        self.theme_btn.pack(side=RIGHT, padx=(10, 0))
        ToolTip(self.theme_btn, text="Alternar tema claro / escuro")

    def _build_drop_zone(self):
        """Zona de arrastar-e-soltar / botões de seleção."""
        zone_frame = ttk.LabelFrame(
            self.main_frame, text="Adicionar Imagens", padding=10, bootstyle="info"
        )
        zone_frame.pack(fill=X, pady=(0, 8))

        # Área de drop
        self.drop_label = ttk.Label(
            zone_frame,
            text=(
                "Arraste e solte imagens aqui\n"
                "ou utilize os botões abaixo"
                if DND_AVAILABLE
                else "Utilize os botões abaixo para adicionar imagens"
            ),
            font=("-size", 11),
            anchor=CENTER,
            justify=CENTER,
            bootstyle="secondary",
            padding=(20, 18),
            relief="groove",
        )
        self.drop_label.pack(fill=X, pady=(0, 8))

        if DND_AVAILABLE:
            self.drop_label.drop_target_register(DND_FILES)
            self.drop_label.dnd_bind("<<Drop>>", self._on_drop)
            self.drop_label.dnd_bind("<<DragEnter>>", self._on_drag_enter)
            self.drop_label.dnd_bind("<<DragLeave>>", self._on_drag_leave)

        # Botões de ação
        btn_frame = ttk.Frame(zone_frame)
        btn_frame.pack(fill=X)

        self.add_btn = ttk.Button(
            btn_frame,
            text=f"{ICON_ADD} Adicionar Arquivos",
            bootstyle="success",
            command=self._add_files,
        )
        self.add_btn.pack(side=LEFT, padx=(0, 5))
        ToolTip(self.add_btn, text="Selecionar imagens para converter")

        self.add_folder_btn = ttk.Button(
            btn_frame,
            text=f"{ICON_FOLDER} Adicionar Pasta",
            bootstyle="success-outline",
            command=self._add_folder,
        )
        self.add_folder_btn.pack(side=LEFT, padx=(0, 5))
        ToolTip(self.add_folder_btn, text="Adicionar todas as imagens de uma pasta")

        self.remove_btn = ttk.Button(
            btn_frame,
            text=f"{ICON_REMOVE} Remover Selecionadas",
            bootstyle="warning-outline",
            command=self._remove_selected,
        )
        self.remove_btn.pack(side=LEFT, padx=(0, 5))

        self.clear_btn = ttk.Button(
            btn_frame,
            text=f"{ICON_CLEAR} Limpar Lista",
            bootstyle="danger-outline",
            command=self._clear_list,
        )
        self.clear_btn.pack(side=LEFT)

    def _build_file_list(self):
        """Treeview com lista de imagens selecionadas."""
        list_frame = ttk.LabelFrame(
            self.main_frame, text="Imagens Selecionadas", padding=5, bootstyle="info"
        )
        list_frame.pack(fill=BOTH, expand=YES, pady=(0, 8))

        columns = ("name", "format", "size", "path")
        self.tree = ttk.Treeview(
            list_frame,
            columns=columns,
            show="headings",
            selectmode="extended",
            height=8,
        )

        self.tree.heading("name", text="Nome do Arquivo", anchor=W)
        self.tree.heading("format", text="Formato", anchor=CENTER)
        self.tree.heading("size", text="Tamanho", anchor=CENTER)
        self.tree.heading("path", text="Caminho", anchor=W)

        self.tree.column("name", width=220, minwidth=150)
        self.tree.column("format", width=80, minwidth=60, anchor=CENTER)
        self.tree.column("size", width=100, minwidth=70, anchor=CENTER)
        self.tree.column("path", width=350, minwidth=200)

        scrollbar = ttk.Scrollbar(
            list_frame, orient=VERTICAL, command=self.tree.yview
        )
        self.tree.configure(yscrollcommand=scrollbar.set)

        self.tree.pack(side=LEFT, fill=BOTH, expand=YES)
        scrollbar.pack(side=RIGHT, fill=Y)

        # Label de contagem
        self.count_label = ttk.Label(
            self.main_frame, text="0 imagens selecionadas", bootstyle="secondary"
        )
        self.count_label.pack(anchor=W, pady=(0, 4))

    def _build_options_bar(self):
        """Barra de opções: formato de destino, pasta de saída, qualidade."""
        opts_frame = ttk.LabelFrame(
            self.main_frame, text="Opções de Conversão", padding=10, bootstyle="info"
        )
        opts_frame.pack(fill=X, pady=(0, 8))

        row = ttk.Frame(opts_frame)
        row.pack(fill=X)

        # Formato de destino
        ttk.Label(row, text="Formato de destino:").pack(side=LEFT, padx=(0, 5))
        self.format_var = ttk.StringVar(value="WebP")
        fmt_combo = ttk.Combobox(
            row,
            textvariable=self.format_var,
            values=OUTPUT_FORMATS,
            state="readonly",
            width=10,
            bootstyle="info",
        )
        fmt_combo.pack(side=LEFT, padx=(0, 20))
        ToolTip(fmt_combo, text="Selecione o formato de saída")

        # Qualidade
        ttk.Label(row, text="Qualidade:").pack(side=LEFT, padx=(0, 5))
        self.quality_var = ttk.IntVar(value=90)
        quality_spin = ttk.Spinbox(
            row,
            from_=10,
            to=100,
            textvariable=self.quality_var,
            width=5,
            bootstyle="info",
        )
        quality_spin.pack(side=LEFT, padx=(0, 20))
        ToolTip(quality_spin, text="Qualidade da imagem (10-100, para JPEG/WebP/AVIF)")

        # Pasta de destino
        ttk.Label(row, text="Pasta de destino:").pack(side=LEFT, padx=(0, 5))
        self.folder_var = ttk.StringVar(value="")
        self.folder_entry = ttk.Entry(
            row, textvariable=self.folder_var, state="readonly", width=30
        )
        self.folder_entry.pack(side=LEFT, fill=X, expand=YES, padx=(0, 5))

        folder_btn = ttk.Button(
            row,
            text=f"{ICON_FOLDER}",
            bootstyle="info-outline",
            command=self._select_output_folder,
            width=3,
        )
        folder_btn.pack(side=LEFT)
        ToolTip(folder_btn, text="Escolher pasta de saída")

        # Botão de converter
        row2 = ttk.Frame(opts_frame)
        row2.pack(fill=X, pady=(10, 0))

        self.convert_btn = ttk.Button(
            row2,
            text=f"{ICON_CONVERT}  Converter Tudo",
            bootstyle="success",
            command=self._start_conversion,
            padding=(20, 8),
        )
        self.convert_btn.pack(side=RIGHT)
        ToolTip(self.convert_btn, text="Iniciar conversão em lote")

    def _build_progress_section(self):
        """Barra de progresso e status."""
        prog_frame = ttk.Frame(self.main_frame)
        prog_frame.pack(fill=X, pady=(0, 4))

        self.progress_var = ttk.DoubleVar(value=0)
        self.progress_bar = ttk.Progressbar(
            prog_frame,
            variable=self.progress_var,
            maximum=100,
            bootstyle="success-striped",
        )
        self.progress_bar.pack(fill=X, side=LEFT, expand=YES, padx=(0, 10))

        self.progress_label = ttk.Label(prog_frame, text="0%", width=6)
        self.progress_label.pack(side=RIGHT)

    def _build_log_section(self):
        """Área de log de conversão."""
        log_frame = ttk.LabelFrame(
            self.main_frame, text="Log de Conversão", padding=5, bootstyle="info"
        )
        log_frame.pack(fill=BOTH, expand=YES)

        self.log_text = ScrolledText(log_frame, height=6, autohide=True)
        self.log_text.pack(fill=BOTH, expand=YES)
        self.log_text.text.configure(state="disabled", wrap="word")

    # ----- Ações -----

    def _toggle_theme(self):
        """Alterna entre tema escuro e claro."""
        if self.current_theme == self.DARK_THEME:
            self.current_theme = self.LIGHT_THEME
        else:
            self.current_theme = self.DARK_THEME
        self.style.theme_use(self.current_theme)

    def _add_files(self):
        """Abre diálogo para seleção de arquivos."""
        filetypes = [
            ("Imagens", "*.webp *.avif *.jpeg *.jpg *.png *.jfif *.bmp *.tiff *.tif *.gif"),
            ("Todos os arquivos", "*.*"),
        ]
        paths = filedialog.askopenfilenames(
            title="Selecionar Imagens",
            filetypes=filetypes,
        )
        if paths:
            self._add_image_paths(paths)

    def _add_folder(self):
        """Adiciona todas as imagens de uma pasta."""
        folder = filedialog.askdirectory(title="Selecionar Pasta com Imagens")
        if not folder:
            return
        paths = []
        for f in sorted(Path(folder).iterdir()):
            if f.is_file() and f.suffix.lower() in SUPPORTED_INPUT_EXTENSIONS:
                paths.append(str(f))
        if paths:
            self._add_image_paths(paths)
        else:
            messagebox.showinfo(
                "Nenhuma imagem", "Nenhuma imagem suportada encontrada na pasta."
            )

    def _add_image_paths(self, paths):
        """Processa e adiciona caminhos de imagens à lista."""
        existing = {item["path"] for item in self.image_files}
        added = 0
        for p in paths:
            p = str(p).strip().strip("{}")  # Limpar formatação DnD
            if p in existing:
                continue
            ext = Path(p).suffix.lower()
            if ext not in SUPPORTED_INPUT_EXTENSIONS:
                continue
            if not os.path.isfile(p):
                continue

            fmt = detect_format(p)
            size = os.path.getsize(p)
            name = Path(p).name

            entry = {"path": p, "name": name, "format": fmt, "size": size}
            self.image_files.append(entry)
            existing.add(p)

            self.tree.insert(
                "",
                END,
                values=(name, fmt, self._format_size(size), p),
            )
            added += 1

        self._update_count()
        if added > 0:
            self._log(f"{ICON_ADD} {added} imagem(ns) adicionada(s)")

    def _remove_selected(self):
        """Remove imagens selecionadas da lista."""
        selected = self.tree.selection()
        if not selected:
            return
        paths_to_remove = set()
        for item_id in selected:
            vals = self.tree.item(item_id, "values")
            paths_to_remove.add(vals[3])  # coluna path
            self.tree.delete(item_id)

        self.image_files = [
            f for f in self.image_files if f["path"] not in paths_to_remove
        ]
        self._update_count()
        self._log(f"{ICON_REMOVE} {len(paths_to_remove)} imagem(ns) removida(s)")

    def _clear_list(self):
        """Limpa toda a lista de imagens."""
        if not self.image_files:
            return
        self.tree.delete(*self.tree.get_children())
        self.image_files.clear()
        self._update_count()
        self._log(f"{ICON_CLEAR} Lista limpa")

    def _select_output_folder(self):
        """Seleciona pasta de destino para os arquivos convertidos."""
        folder = filedialog.askdirectory(title="Selecionar Pasta de Destino")
        if folder:
            self.output_folder = folder
            self.folder_var.set(folder)

    def _start_conversion(self):
        """Inicia o processo de conversão em uma thread separada."""
        if self.is_converting:
            messagebox.showwarning("Aviso", "Conversão já em andamento.")
            return
        if not self.image_files:
            messagebox.showwarning("Aviso", "Nenhuma imagem na lista.")
            return
        if not self.output_folder:
            messagebox.showwarning("Aviso", "Selecione uma pasta de destino.")
            return

        target = self.format_var.get()
        if target == "AVIF" and not AVIF_SUPPORTED:
            messagebox.showerror(
                "Erro",
                "Formato AVIF não disponível.\nInstale: pip install pillow-avif-plugin",
            )
            return

        self.is_converting = True
        self.convert_btn.configure(state="disabled")
        self.progress_var.set(0)
        self.progress_label.configure(text="0%")
        self._log(f"\n{'='*50}")
        self._log(
            f"{ICON_CONVERT} Iniciando conversão de {len(self.image_files)} "
            f"imagem(ns) para {target}..."
        )

        thread = threading.Thread(target=self._convert_worker, daemon=True)
        thread.start()

    def _convert_worker(self):
        """Worker que executa as conversões em background."""
        total = len(self.image_files)
        target = self.format_var.get()
        quality = self.quality_var.get()
        success_count = 0
        error_count = 0
        start_time = time.time()

        for i, item in enumerate(self.image_files):
            ok, msg = convert_image(
                item["path"], self.output_folder, target, quality
            )
            if ok:
                success_count += 1
            else:
                error_count += 1

            progress = ((i + 1) / total) * 100
            # Atualizar UI na thread principal
            self.root.after(0, self._update_progress, progress, msg)

        elapsed = time.time() - start_time
        summary = (
            f"\n{ICON_CHECK} Conversão concluída em {elapsed:.1f}s  |  "
            f"Sucesso: {success_count}  |  Erros: {error_count}"
        )
        self.root.after(0, self._conversion_done, summary)

    def _update_progress(self, percent: float, log_msg: str):
        """Atualiza barra de progresso e log (chamado na thread principal)."""
        self.progress_var.set(percent)
        self.progress_label.configure(text=f"{percent:.0f}%")
        self._log(log_msg)

    def _conversion_done(self, summary: str):
        """Finaliza a conversão."""
        self._log(summary)
        self._log(f"{'='*50}\n")
        self.is_converting = False
        self.convert_btn.configure(state="normal")
        messagebox.showinfo("Concluído", summary.replace("\n", "").strip())

    # ----- Drag-and-Drop -----

    def _on_drop(self, event):
        """Processa arquivos arrastados para a zona de drop."""
        data = event.data
        # tkinterdnd2 pode retornar caminhos entre chaves se contiver espaços
        paths = self._parse_dnd_data(data)
        all_files = []
        for p in paths:
            p = p.strip()
            if os.path.isdir(p):
                for f in sorted(Path(p).iterdir()):
                    if f.is_file() and f.suffix.lower() in SUPPORTED_INPUT_EXTENSIONS:
                        all_files.append(str(f))
            elif os.path.isfile(p):
                all_files.append(p)
        if all_files:
            self._add_image_paths(all_files)
        self.drop_label.configure(bootstyle="secondary")

    def _on_drag_enter(self, event):
        self.drop_label.configure(bootstyle="info")

    def _on_drag_leave(self, event):
        self.drop_label.configure(bootstyle="secondary")

    @staticmethod
    def _parse_dnd_data(data: str) -> list[str]:
        """Analisa dados de drag-and-drop que podem conter caminhos entre chaves."""
        paths = []
        i = 0
        while i < len(data):
            if data[i] == "{":
                j = data.index("}", i)
                paths.append(data[i + 1 : j])
                i = j + 1
            elif data[i] == " ":
                i += 1
            else:
                j = data.find(" ", i)
                if j == -1:
                    j = len(data)
                paths.append(data[i:j])
                i = j
        return paths

    # ----- Utilidades -----

    def _log(self, message: str):
        """Adiciona mensagem ao log."""
        self.log_text.text.configure(state="normal")
        timestamp = datetime.now().strftime("%H:%M:%S")
        self.log_text.text.insert(END, f"[{timestamp}] {message}\n")
        self.log_text.text.see(END)
        self.log_text.text.configure(state="disabled")

    def _update_count(self):
        """Atualiza o label de contagem de imagens."""
        n = len(self.image_files)
        self.count_label.configure(
            text=f"{n} imagem{'s' if n != 1 else ''} selecionada{'s' if n != 1 else ''}"
        )

    @staticmethod
    def _format_size(size_bytes: int) -> str:
        """Formata tamanho em bytes para string legível."""
        for unit in ("B", "KB", "MB", "GB"):
            if size_bytes < 1024:
                return f"{size_bytes:.1f} {unit}"
            size_bytes /= 1024
        return f"{size_bytes:.1f} TB"

    def _center_window(self):
        """Centraliza a janela na tela."""
        self.root.update_idletasks()
        w = self.root.winfo_width()
        h = self.root.winfo_height()
        sw = self.root.winfo_screenwidth()
        sh = self.root.winfo_screenheight()
        x = (sw - w) // 2
        y = (sh - h) // 2
        self.root.geometry(f"{w}x{h}+{x}+{y}")

    def run(self):
        """Inicia o loop principal da aplicação."""
        self.root.mainloop()


# ---------------------------------------------------------------------------
# Ponto de entrada
# ---------------------------------------------------------------------------

def main():
    app = ImageConverterApp()
    app.run()


if __name__ == "__main__":
    main()
