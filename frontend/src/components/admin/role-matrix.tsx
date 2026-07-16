import { Check } from "lucide-react";

const ROLE_LABELS: Record<string, string> = {
  "Super Administrator": "超级管理员",
  "System Administrator": "系统管理员",
  "Content Editor": "内容编辑",
  "Content Reviewer": "内容审核",
  Publisher: "内容发布",
  Sales: "业务运营",
  Viewer: "只读查看",
};

const ROLE_DESCRIPTIONS: Record<string, string> = {
  "Super Administrator": "拥有全部管理权限，并负责保护系统最高权限账号。",
  "System Administrator": "管理员工、系统设置和审计记录。",
  "Content Editor": "创建、编辑、翻译内容并提交审核。",
  "Content Reviewer": "审核内容、退回修改并管理网站预览。",
  Publisher: "审核并直接发布网站内容。",
  Sales: "处理询盘、分配负责人并记录跟进。",
  Viewer: "只查看内容、媒体、询盘和审计记录。",
};

const PERMISSION_LABELS: Record<string, string> = {
  "content.read": "查看内容",
  "content.write": "编辑内容",
  "content.submit": "提交内容审核",
  "content.review": "审核内容",
  "content.publish": "发布内容",
  "preview.create": "创建网站预览",
  "preview.share": "分享网站预览",
  "preview.revoke": "撤销预览链接",
  "media.read": "查看媒体资源",
  "media.write": "管理媒体资源",
  "inquiry.read": "查看询盘",
  "inquiry.assign": "分配询盘负责人",
  "inquiry.status": "更新询盘状态",
  "inquiry.note": "记录询盘跟进",
  "inquiry.retry": "重试询盘通知",
  "inquiry.export": "导出询盘",
  "staff.manage": "管理员工与角色",
  "settings.manage": "管理系统设置",
  "audit.read": "查看审计日志",
};

export function staffRoleLabel(name: string): string {
  return ROLE_LABELS[name] ?? "自定义角色";
}

function permissionLabel(permission: string): string {
  return PERMISSION_LABELS[permission] ?? "其他系统权限";
}

export function RoleMatrix({
  roles,
}: {
  roles: readonly {
    id: string;
    name: string;
    permissions: readonly string[];
  }[];
}) {
  return (
    <section
      aria-labelledby="role-matrix"
      className="border border-neutral-200 bg-white"
    >
      <div className="border-b border-neutral-200 px-4 py-4 sm:px-5">
        <h2 className="text-lg font-semibold text-neutral-950" id="role-matrix">
          角色权限说明
        </h2>
        <p className="mt-1 text-sm leading-6 text-neutral-600">
          角色由系统统一维护，员工可以同时拥有多个角色。
        </p>
      </div>
      <div className="grid gap-px bg-neutral-200 md:grid-cols-2">
        {roles.map((role) => (
          <article className="bg-white p-4 sm:p-5" key={role.id}>
            <h3 className="font-semibold text-neutral-950">
              {staffRoleLabel(role.name)}
            </h3>
            <p className="mt-1 min-h-12 text-sm leading-6 text-neutral-600">
              {ROLE_DESCRIPTIONS[role.name] ?? "按业务需要配置的自定义角色。"}
            </p>
            <ul className="mt-3 grid gap-2" aria-label={`${staffRoleLabel(role.name)}权限`}>
              {role.permissions.map((permission) => (
                <li
                  className="flex items-start gap-2 text-sm leading-5 text-neutral-700"
                  key={permission}
                >
                  <Check
                    aria-hidden="true"
                    className="mt-0.5 size-4 shrink-0 text-emerald-700"
                  />
                  {permissionLabel(permission)}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}
