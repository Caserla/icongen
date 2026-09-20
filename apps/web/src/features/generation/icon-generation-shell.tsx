"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "@/components/i18n/locale-provider";
import {
  MAX_CHINESE_PROJECT_DESCRIPTION_CHARACTERS,
  MAX_CHINESE_PROJECT_NAME_CHARACTERS,
  MAX_ENGLISH_PROJECT_DESCRIPTION_WORDS,
  MAX_ENGLISH_PROJECT_NAME_WORDS,
  MAX_ICON_PROJECTS,
} from "@icongen/shared";
import { Toast } from "@/components/ui/toast";
import libraryCss from "@/features/library/library.module.css";
import { SelectionPopover, useSelectionPopover } from "@/features/library/selection-popover";
import { IconPreviewGrid } from "./components/icon-preview-grid";
import { PreviewCanvas } from "./components/preview-canvas";
import { ICON_GENERATION_CATEGORIES } from "./icon-generation-categories";
import css from "./icon-generation-shell.module.css";
import { DEFAULT_PROJECT_THEME, type ProjectTheme } from "./project-themes";
import type { ManualPreviewColor } from "./manual-preview-color";
import { ManualColorPreviewImage } from "./components/manual-color-preview-image";

type IconProject = { id: string; name: string; description?: string; theme?: ProjectTheme | null; ai_theme?: ProjectTheme | null; custom_theme?: ProjectTheme | null; theme_status?: string; theme_source?: string };

export function IconGenerationShell() {
  const { locale } = useLocale();
  const zh = locale === "zh";
  const [categoryId, setCategoryId] = useState(ICON_GENERATION_CATEGORIES[0].id);
  const [browsingCategoryId, setBrowsingCategoryId] = useState(
    ICON_GENERATION_CATEGORIES[0].id,
  );
  const [subcategoryId, setSubcategoryId] = useState(
    ICON_GENERATION_CATEGORIES[0].children[0]?.id ?? "",
  );
  const [previewSvg, setPreviewSvg] = useState(
    `/generation/style-subcategories/${ICON_GENERATION_CATEGORIES[0].children[0]?.id}.svg`,
  );
  const [manualPreviewColor, setManualPreviewColor] = useState<ManualPreviewColor | null>(null);
  const [subcategoryOpen, setSubcategoryOpen] = useState(false);
  const [projects, setProjects] = useState<IconProject[]>([]);
  const [unlinkedTheme, setUnlinkedTheme] = useState<ProjectTheme>(DEFAULT_PROJECT_THEME);
  const [unlinkedThemeSource, setUnlinkedThemeSource] = useState<"manual" | "preset">("preset");
  const [unlinkedCustomTheme, setUnlinkedCustomTheme] = useState<ProjectTheme | null>(null);
  const [projectName, setProjectName] = useState("");
  const [activeProjectId, setActiveProjectId] = useState("");
  const [projectBusy, setProjectBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<IconProject | null>(null);
  const [deletingProject, setDeletingProject] = useState(false);
  const deleteDialogRef = useRef<HTMLDialogElement>(null);
  const deleteInFlight = useRef(false);
  useEffect(() => {
    if (deleteTarget) deleteDialogRef.current?.showModal();
    else deleteDialogRef.current?.close();
  }, [deleteTarget]);
  const [generationLocked, setGenerationLocked] = useState(false);
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [projectDialogClosing, setProjectDialogClosing] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState("");
  const [projectDraftName, setProjectDraftName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [projectToast, setProjectToast] = useState<{ id: number; message: string; variant?: "error"|"warning"|"success" } | null>(null);
  const subcategoryRef = useRef<HTMLDivElement>(null);
  const projectInputRef = useRef<HTMLInputElement>(null);
  const projectDialogRef = useRef<HTMLDialogElement>(null);
  const projectDialogCloseTimer = useRef<number | null>(null);
  const closeProjectDialog = () => {
    if (!projectDialogOpen || projectDialogClosing) return;
    setProjectDialogClosing(true);
    if (projectDialogCloseTimer.current) window.clearTimeout(projectDialogCloseTimer.current);
    projectDialogCloseTimer.current = window.setTimeout(() => {
      setProjectDialogOpen(false);
      setProjectDialogClosing(false);
      projectDialogCloseTimer.current = null;
    }, 190);
  };
  const {
    open: projectMenuOpen,
    setOpen: setProjectMenuOpen,
    root: projectControlRef,
    trigger: projectTriggerRef,
    close: closeProjectMenu,
    rootProps: projectRootProps,
  } = useSelectionPopover();
  useEffect(() => {
    if (generationLocked) setProjectMenuOpen(false);
  }, [generationLocked, setProjectMenuOpen]);
  const activeCategory =
    ICON_GENERATION_CATEGORIES.find(
      (category) => category.id === browsingCategoryId,
    ) ??
    ICON_GENERATION_CATEGORIES[0];

  const deleteProject = async () => {
    if (!deleteTarget || deleteInFlight.current || generationLocked) return;
    deleteInFlight.current = true;
    setDeletingProject(true);
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(deleteTarget.id)}`, {
        method: "DELETE", credentials: "same-origin", signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error("delete failed");
      setProjects(items => items.filter(item => item.id !== deleteTarget.id));
      if (activeProjectId === deleteTarget.id) { setActiveProjectId(""); setProjectName(""); }
      setDeleteTarget(null);
      setProjectToast({ id: Date.now(), message: zh ? "项目已删除" : "Project deleted", variant: "success" });
    } catch {
      setProjectToast({ id: Date.now(), message: zh ? "删除失败，请稍后重试" : "Deletion failed. Please try again.", variant: "error" });
    } finally {
      deleteInFlight.current = false;
      setDeletingProject(false);
    }
  };

  const openCategory = (nextCategoryId: string) => {
    if (subcategoryOpen && nextCategoryId === browsingCategoryId) {
      setSubcategoryOpen(false);
      return;
    }
    setCategoryId(nextCategoryId);
    setBrowsingCategoryId(nextCategoryId);
    const nextCategory = ICON_GENERATION_CATEGORIES.find(
      (category) => category.id === nextCategoryId,
    );
    const keepsSelectedSubcategory = categoryId === nextCategoryId
      && Boolean(nextCategory?.children.some(child => child.id === subcategoryId))
      && previewSvg.includes("/style-subcategories/");
    if (!keepsSelectedSubcategory) {
      setPreviewSvg(nextCategory?.icon ?? "");
    }
    setSubcategoryOpen(true);
  };

  const selectSubcategory = (nextSubcategoryId: string) => {
    setBrowsingCategoryId(activeCategory.id);
    setSubcategoryId(nextSubcategoryId);
    setPreviewSvg(`/generation/style-subcategories/${nextSubcategoryId}.svg`);
  };

  useEffect(() => {
    let active = true;
    void fetch("/api/projects", { credentials: "same-origin", cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("projects unavailable");
        return response.json() as Promise<{ items?: IconProject[] }>;
      })
      .then((payload) => {
        if (active) {
          setProjects(payload.items ?? []);
        }
      })
      .catch(() => {
        if (active) {
          setProjects([]);
        }
      });
    return () => { active = false; };
  }, [zh]);

  const validateProjectName = (name: string) => {
    const containsChinese = /\p{Script=Han}/u.test(name);
    if (containsChinese && Array.from(name).length > MAX_CHINESE_PROJECT_NAME_CHARACTERS)
      return zh ? `中文项目名称最多 ${MAX_CHINESE_PROJECT_NAME_CHARACTERS} 个字` : `Chinese project names can contain up to ${MAX_CHINESE_PROJECT_NAME_CHARACTERS} characters`;
    if (!containsChinese && name.split(/\s+/u).length > MAX_ENGLISH_PROJECT_NAME_WORDS)
      return zh ? `英文项目名称最多 ${MAX_ENGLISH_PROJECT_NAME_WORDS} 个单词` : `English project names can contain up to ${MAX_ENGLISH_PROJECT_NAME_WORDS} words`;
    return "";
  };

  const validateProjectDescription = (description: string) => {
    const value = description.trim();
    if (!value) return zh ? "请输入项目简介" : "Enter a project description";
    const containsChinese = /\p{Script=Han}/u.test(value);
    if (containsChinese && Array.from(value).length > MAX_CHINESE_PROJECT_DESCRIPTION_CHARACTERS)
      return zh ? `中文项目简介最多 ${MAX_CHINESE_PROJECT_DESCRIPTION_CHARACTERS} 个字` : `Chinese descriptions can contain up to ${MAX_CHINESE_PROJECT_DESCRIPTION_CHARACTERS} characters`;
    if (!containsChinese && value.split(/\s+/u).length > MAX_ENGLISH_PROJECT_DESCRIPTION_WORDS)
      return zh ? `英文项目简介最多 ${MAX_ENGLISH_PROJECT_DESCRIPTION_WORDS} 个单词` : `English descriptions can contain up to ${MAX_ENGLISH_PROJECT_DESCRIPTION_WORDS} words`;
    return "";
  };

  const matchedProject = projects.find(project =>
    project.name.toLocaleLowerCase() === projectName.trim().toLocaleLowerCase(),
  );

  const openProjectEditor = (project: IconProject) => {
    setEditingProjectId(project.id);
    setActiveProjectId(project.id);
    setProjectName(project.name);
    setProjectDraftName(project.name);
    setProjectDescription(project.description ?? "");
    closeProjectMenu();
    setProjectDialogOpen(true);
  };

  const addOrAssociateProject = () => {
    const nextProject = projectName.trim();
    if (!nextProject || projectBusy || generationLocked) return;
    const nameError = validateProjectName(nextProject);
    if (nameError) {
      setProjectToast({ id: Date.now(), message: nameError });
      return;
    }
    const existing = projects.find((project) => project.name.toLocaleLowerCase() === nextProject.toLocaleLowerCase());
    if (existing) {
      openProjectEditor(existing);
      return;
    }
    setEditingProjectId("");
    setProjectDraftName(nextProject);
    setProjectDescription("");
    closeProjectMenu();
    setProjectDialogOpen(true);
  };

  const saveProject = async () => {
    if (generationLocked) return;
    const nextProject = projectDraftName.trim();
    const nameError = validateProjectName(nextProject);
    const descriptionError = validateProjectDescription(projectDescription);
    if (nameError || descriptionError) {
      setProjectToast({ id: Date.now(), message: nameError || descriptionError });
      return;
    }
    if (!editingProjectId && projects.length >= MAX_ICON_PROJECTS) {
      setProjectToast({ id: Date.now(), message: zh ? `每个账号最多创建 ${MAX_ICON_PROJECTS} 个项目` : `You can create up to ${MAX_ICON_PROJECTS} projects` });
      return;
    }
    setProjectBusy(true);
    try {
      const response = await fetch(editingProjectId ? `/api/projects/${editingProjectId}` : "/api/projects", {
        method: editingProjectId ? "PATCH" : "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nextProject, description: projectDescription.trim() }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { message?: string } | null;
        if (response.status === 503)
          throw new Error(zh ? "项目服务尚未完成数据库配置" : "Project storage is not configured yet");
        if (response.status === 409 && payload?.message?.includes(String(MAX_ICON_PROJECTS)))
          throw new Error(zh ? `每个账号最多创建 ${MAX_ICON_PROJECTS} 个项目` : `You can create up to ${MAX_ICON_PROJECTS} projects`);
        if (response.status === 409)
          throw new Error(zh ? "项目名称已存在" : "A project with this name already exists");
        throw new Error(payload?.message || (editingProjectId ? "project update failed" : "project create failed"));
      }
      const payload = await response.json() as { item: IconProject };
      setProjects((items) => editingProjectId
        ? items.map(item => item.id === payload.item.id ? payload.item : item)
        : [payload.item, ...items]);
      setActiveProjectId(payload.item.id);
      setProjectName(payload.item.name);
      closeProjectDialog();
      closeProjectMenu();
      if (editingProjectId) {
        setProjectToast({ id: Date.now(), message: zh ? "项目已更新" : "Project updated", variant: "success" });
      } else void fetch(`/api/projects/${payload.item.id}/theme`, { method: "POST", credentials: "same-origin" }).then(async response => {
        if (!response.ok) throw new Error("theme failed");
        const themed = await response.json() as { item: IconProject };
        setProjects(items => items.map(item => item.id === themed.item.id ? themed.item : item));
      }).catch(() => setProjectToast({ id: Date.now(), variant: "warning", message: zh ? "项目创建成功，但主题色生成失败，已使用默认主题色" : "Project created, but theme generation failed. The default theme is being used." }));
    } catch (error) {
      const message = error instanceof Error && !["project create failed", "project update failed"].includes(error.message)
          ? error.message
          : editingProjectId
            ? (zh ? "项目更新失败，请稍后重试" : "Project update failed. Try again.")
            : (zh ? "项目创建失败，请稍后重试" : "Project creation failed. Try again.");
      setProjectToast({ id: Date.now(), message });
      setProjectMenuOpen(true);
    } finally {
      setProjectBusy(false);
    }
  };

  useEffect(() => {
    const dialog = projectDialogRef.current;
    if (!dialog) return;
    if (projectDialogOpen && !dialog.open) { setProjectDialogClosing(false); dialog.showModal(); }
    if (!projectDialogOpen && dialog.open) dialog.close();
  }, [projectDialogOpen]);

  useEffect(() => () => { if (projectDialogCloseTimer.current) window.clearTimeout(projectDialogCloseTimer.current); }, []);

  useEffect(() => {
    if (!subcategoryOpen) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (subcategoryRef.current && event.composedPath().includes(subcategoryRef.current)) return;
      setSubcategoryOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSubcategoryOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer, true);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer, true);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [subcategoryOpen]);

  return (
    <section
      className={`${libraryCss.library} ${css.shell}`}
      data-icon-generation-shell
      data-locale={locale}
      aria-label={zh ? "图标生成" : "Icon generation"}
      onPointerDownCapture={(event) => {
        if (!subcategoryOpen) return;
        if (subcategoryRef.current && event.nativeEvent.composedPath().includes(subcategoryRef.current)) return;
        setSubcategoryOpen(false);
      }}
      onClickCapture={(event) => {
        if (!subcategoryOpen) return;
        if (subcategoryRef.current && event.nativeEvent.composedPath().includes(subcategoryRef.current)) return;
        setSubcategoryOpen(false);
      }}
    >
      <aside className={`${libraryCss.sidebar} ${css.rail}`}>
        <nav className={css.categoryList} data-canvas-glass aria-label={zh ? "图标主分类" : "Icon categories"}>
          <h2 className={css.title}>{zh ? "图标风格" : "Icon Style"}</h2>
          <div className={css.categoryItems}>
            {ICON_GENERATION_CATEGORIES.map((category) => (
              <button
                key={category.id}
                className={css.categoryItem}
                type="button"
                aria-pressed={category.id === categoryId}
                data-category-trigger
                onClick={() => openCategory(category.id)}
              >
                <span className={css.itemLabel}>
                  <img className={css.categoryIcon} src={`${category.icon}?v=approved-20260915-distinct5`} alt="" aria-hidden="true" />
                  <span>{category.label[locale]}</span>
                </span>
              </button>
            ))}
          </div>
        </nav>
      </aside>
      <div className={`${libraryCss.main} ${css.canvas}`} aria-label={zh ? "生成工作区" : "Generation workspace"}>
        <div ref={projectControlRef} className={css.projectControl} {...projectRootProps}>
          <form
            className={css.projectComposer}
            data-canvas-glass
            onSubmit={(event) => {
              event.preventDefault();
              projectInputRef.current?.blur();
              addOrAssociateProject();
            }}
          >
            <span className={css.projectInputWrap}>
              <input
                ref={projectInputRef}
                value={projectName}
                disabled={generationLocked}
                onChange={(event) => {
                  const nextName = event.target.value;
                  setProjectName(nextName);
                  const activeProject = projects.find(project => project.id === activeProjectId);
                  if (activeProject && nextName !== activeProject.name) setActiveProjectId("");
                }}
                onFocus={(event) => event.currentTarget.select()}
                placeholder={zh ? "新增或关联项目" : "Add or link a project"}
                aria-label={zh ? "新增或关联项目" : "Add or link a project"}
              />
              <button
                className={css.projectAddButton}
                type="submit"
                disabled={!projectName.trim() || projectBusy || generationLocked}
                data-tooltip={matchedProject ? (zh ? "编辑项目" : "Edit project") : (zh ? "新增项目" : "New project")}
                aria-label={matchedProject
                  ? (zh ? `编辑项目 ${matchedProject.name}` : `Edit project ${matchedProject.name}`)
                  : (zh ? "回车新建项目" : "Press Enter to create project")}
              >
                {matchedProject ? <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="m4 16.5-.5 4 4-.5L19 8.5 15.5 5 4 16.5Z" />
                  <path d="m13.5 7 3.5 3.5" />
                </svg> : <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M19 5v6a4 4 0 0 1-4 4H6" />
                  <path d="m10 11-4 4 4 4" />
                </svg>}
              </button>
            </span>
            <button
              ref={projectTriggerRef}
              className={css.projectListButton}
              type="button"
              data-tooltip={zh ? "选择项目" : "Select project"}
              aria-label={zh ? "选择已有项目" : "Choose an existing project"}
              aria-expanded={projectMenuOpen}
              disabled={projectBusy || generationLocked}
              onClick={() => setProjectMenuOpen((open) => !open)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M3.5 7.5h6l1.8 2h9.2v8.8a2.2 2.2 0 0 1-2.2 2.2H5.7a2.2 2.2 0 0 1-2.2-2.2V7.5Z" />
                <path d="m9 13 3 3 3-3" />
              </svg>
            </button>
          </form>
          {projectMenuOpen ? <SelectionPopover
            className={css.projectMenu}
            label={zh ? "已创建项目" : "Existing projects"}
            value={activeProjectId}
            options={[]}
            above={false}
            align="right"
            onSelect={(projectId) => {
              if (generationLocked) return;
              const project = projects.find((item) => item.id === projectId);
              if (!project) return;
              setActiveProjectId(project.id);
              setProjectName(project.name);
              closeProjectMenu();
            }}
          >
            {projects.map(project => <div key={project.id} className={css.projectMenuRow}>
              <button type="button" className={css.projectMenuSelect} aria-pressed={activeProjectId === project.id}
                disabled={generationLocked} onClick={() => {
                  if (generationLocked) return;
                  setActiveProjectId(project.id); setProjectName(project.name); closeProjectMenu();
                }}><span>{project.name}</span></button>
              <button type="button" className={css.projectMenuDelete} disabled={generationLocked}
                aria-label={zh ? `删除项目 ${project.name}` : `Delete project ${project.name}`}
                onClick={() => { if (!generationLocked) { setDeleteTarget(project); closeProjectMenu(); } }}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 10v7M14 10v7" /></svg>
              </button>
            </div>)}
            {!projects.length ? <p className={css.projectEmpty}>{zh ? "暂无项目" : "No projects"}</p> : null}
          </SelectionPopover> : null}
        </div>
        {subcategoryOpen ? <div key="subcategory-popover" ref={subcategoryRef} className={css.subcategoryArea} aria-label={activeCategory.label[locale]}>
          <div
            className={css.subcategoryTabs}
            data-canvas-glass
            role="tablist"
            aria-label={zh ? "子分类" : "Subcategories"}
          >
            <h2 className={css.subcategoryTitle}>{zh ? "子风格" : "Substyle"}</h2>
            {activeCategory.children.map((child) => (
              <button
                key={child.id}
                className={css.subcategoryItem}
                type="button"
                role="tab"
                aria-selected={child.id === subcategoryId}
                onClick={() => selectSubcategory(child.id)}
              >
                <span className={css.itemLabel}>
                  <img
                    className={css.categoryIcon}
                    src={`/generation/style-subcategories/${child.id}.svg?v=approved-20260915-distinct5`}
                    alt=""
                    aria-hidden="true"
                  />
                  <span>{child.label[locale]}</span>
                </span>
              </button>
            ))}
          </div>
        </div> : null}
        <PreviewCanvas key="preview-canvas" zh={zh} categoryId={categoryId} lastSubcategoryId={subcategoryId} previewSvg={previewSvg} projectId={activeProjectId || undefined} projectName={projects.find(project => project.id === activeProjectId)?.name} projectDescription={projects.find(project => project.id === activeProjectId)?.description} theme={activeProjectId ? projects.find(project => project.id === activeProjectId)?.theme ?? DEFAULT_PROJECT_THEME : unlinkedTheme} aiTheme={projects.find(project => project.id === activeProjectId)?.ai_theme} customTheme={activeProjectId ? projects.find(project => project.id === activeProjectId)?.custom_theme : unlinkedCustomTheme} themeSource={activeProjectId ? projects.find(project => project.id === activeProjectId)?.theme_source ?? "preset" : unlinkedThemeSource} onManualPreviewColorChange={setManualPreviewColor} onGenerationBusyChange={setGenerationLocked} onThemeSave={(nextTheme, choice) => {
          if (!activeProjectId) {
            setUnlinkedTheme(nextTheme);
            setUnlinkedThemeSource(choice.source === "manual" ? "manual" : "preset");
            if (choice.source === "manual") setUnlinkedCustomTheme(nextTheme);
            return;
          }
          const projectId = activeProjectId;
          const previousProject = projects.find(project => project.id === projectId);
          setProjects(items => items.map(item => item.id === projectId ? {
            ...item,
            theme: nextTheme,
            theme_source: choice.source,
            ...(choice.source === "manual" ? { custom_theme: nextTheme } : {}),
          } : item));
          void fetch(`/api/projects/${projectId}/theme`, { method: "PATCH", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ theme: nextTheme, source: choice.source }) }).then(async response => {
            if (!response.ok) throw new Error("save failed");
            const payload = await response.json() as { item: IconProject };
            setProjects(items => items.map(item => item.id === projectId ? { ...item, ...payload.item } : item));
          }).catch(() => {
            if (previousProject) setProjects(items => items.map(item => item.id === projectId ? previousProject : item));
            setProjectToast({ id: Date.now(), message: zh ? "主题色保存失败" : "Theme could not be saved" });
          });
        }}>
        <section className={css.stylePreview} data-canvas-fit-root aria-label={zh ? "风格预览详情" : "Style preview details"}>
          <div className={css.stylePreviewStage} data-canvas-glass>
            <p className={css.stylePreviewNotice}>
              {zh ? "风格预览" : "Style preview"}
            </p>
            <IconPreviewGrid className={css.stylePreviewGrid}>
              {previewSvg.endsWith('/state-pair.svg') ? (
                <div className={css.statePairPreview}>
                  {['state-pair-outline', 'state-pair'].map((id, index) => (
                    <div key={id}>
                      <img src={`/generation/style-subcategories/${id}.svg?v=approved-20260915-distinct5`} alt={index ? 'Solid' : 'Outline'} />
                      <span>{index ? (zh ? '已选中' : 'Selected') : (zh ? '未选中' : 'Unselected')}</span>
                    </div>
                  ))}
                </div>
              ) : previewSvg ? (
                <ManualColorPreviewImage
                  className={css.stylePreviewImage}
                  src={`${previewSvg}?v=approved-20260915-distinct5`}
                  manualColor={manualPreviewColor}
                  alt={zh ? "当前风格 SVG 大图预览" : "Large SVG preview of the current style"}
                />
              ) : null}
            </IconPreviewGrid>
          </div>
        </section>
        </PreviewCanvas>
      </div>
      <dialog
        ref={projectDialogRef}
        className={css.projectDialog}
        data-closing={projectDialogClosing || undefined}
        aria-labelledby="new-project-title"
        onCancel={(event) => {
          event.preventDefault();
          if (!projectBusy) closeProjectDialog();
        }}
        onClose={() => { setProjectDialogOpen(false); setProjectDialogClosing(false); setEditingProjectId(""); }}
        onClick={(event) => {
          if (event.target === event.currentTarget && !projectBusy)
            closeProjectDialog();
        }}
      >
        <form
          className={css.projectDialogCard}
          onSubmit={(event) => {
            event.preventDefault();
            void saveProject();
          }}
        >
          <div className={css.projectDialogHeader}>
            <h2 id="new-project-title">{editingProjectId
              ? (zh ? "编辑项目" : "Edit project")
              : (zh ? "新建项目" : "Create project")}</h2>
            <button type="button" onClick={closeProjectDialog} disabled={projectBusy} aria-label={zh ? "关闭" : "Close"}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
            </button>
          </div>
          <label className={css.projectDialogField}>
            <span>{zh ? "项目名称" : "Project name"}</span>
            <input
              value={projectDraftName}
              autoFocus
              onChange={(event) => setProjectDraftName(event.target.value)}
              placeholder={zh ? "输入项目名称" : "Enter a project name"}
            />
          </label>
          <label className={css.projectDialogField}>
            <span>{zh ? "项目简介" : "Project description"}</span>
            <textarea
              value={projectDescription}
              rows={5}
              onChange={(event) => setProjectDescription(event.target.value)}
              placeholder={zh ? "描述项目用途和功能模块" : "Describe the project purpose and functional modules"}
            />
            <small>
              {/\p{Script=Han}/u.test(projectDescription)
                ? `${Array.from(projectDescription).length}/${MAX_CHINESE_PROJECT_DESCRIPTION_CHARACTERS}`
                : `${projectDescription.trim() ? projectDescription.trim().split(/\s+/u).length : 0}/${MAX_ENGLISH_PROJECT_DESCRIPTION_WORDS} ${zh ? "词" : "words"}`}
            </small>
          </label>
          <button className={css.projectDialogSubmit} type="submit" disabled={projectBusy || !projectDraftName.trim() || !projectDescription.trim()}>
            {projectBusy
              ? (editingProjectId ? (zh ? "保存中…" : "Saving…") : (zh ? "创建中…" : "Creating…"))
              : (editingProjectId ? (zh ? "保存修改" : "Save changes") : (zh ? "创建并关联" : "Create and link"))}
          </button>
        </form>
      </dialog>
      <dialog ref={deleteDialogRef} className={css.projectDialog} aria-labelledby="delete-project-title"
        onCancel={event => { event.preventDefault(); if (!deleteInFlight.current) setDeleteTarget(null); }}>
        <div className={css.projectDialogCard}>
          <div className={css.projectDialogHeader}><h2 id="delete-project-title">{zh ? "确认删除项目？" : "Delete project?"}</h2></div>
          <p className={css.deleteDescription}>{zh
            ? `将永久删除「${deleteTarget?.name ?? ""}」及其生成图标、收藏和回收记录，此操作无法撤销。`
            : `Permanently delete “${deleteTarget?.name ?? ""}” and its generated icons, favorites and recycle records? This cannot be undone.`}</p>
          <div className={css.deleteActions}>
            <button type="button" autoFocus disabled={deletingProject} onClick={() => setDeleteTarget(null)}>{zh ? "取消" : "Cancel"}</button>
            <button type="button" className={css.projectDialogSubmit} disabled={deletingProject || generationLocked} onClick={() => void deleteProject()}>
              {deletingProject ? (zh ? "删除中…" : "Deleting…") : (zh ? "确认删除" : "Delete project")}
            </button>
          </div>
        </div>
      </dialog>
      {projectToast ? <Toast key={projectToast.id} message={projectToast.message} variant={projectToast.variant ?? "error"} /> : null}
    </section>
  );
}
