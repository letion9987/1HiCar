import type { UserProfile } from "../services/userProfileApi";

const membershipBtnClass =
  "rounded-full bg-gradient-to-r from-[#8E2DE2] to-[#4A00E0] px-2.5 py-1 text-[10px] font-black text-white shrink-0";

type Props = {
  profile: UserProfile;
  onMembershipClick?: () => void;
};

/**
 * 个人中心个人信息区：与设计稿一致（大头像、昵称、会员等级、手机号）
 */
export default function UserIdentityDisplay({ profile, onMembershipClick }: Props) {
  return (
    <div className="flex items-center gap-5">
      <div className="size-20 shrink-0 overflow-hidden rounded-full border-2 border-primary/20 bg-neutral-200">
        <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xl font-bold text-slate-900">{profile.displayName}</span>
          {onMembershipClick ? (
            <button type="button" onClick={onMembershipClick} className={membershipBtnClass}>
              {profile.membershipLevelLabel}
            </button>
          ) : (
            <span className={membershipBtnClass}>{profile.membershipLevelLabel}</span>
          )}
        </div>
        <p className="mt-1 text-base text-slate-500">{profile.phoneMasked}</p>
      </div>
    </div>
  );
}
