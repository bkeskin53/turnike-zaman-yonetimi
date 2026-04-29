"use client";

import type { CompanyManagementAccess } from "./companyManagementAccess";
import type { CompanyManagementModuleKey } from "./companyManagementRegistry";

import LocationGroupsPanel from "./location-groups/LocationGroupsPanel";
import LocationsPanel from "./locations/LocationsPanel";

function WorkspaceCard(props: {
  moduleKey: CompanyManagementModuleKey;
  createModuleKey?: CompanyManagementModuleKey | null;
  access: CompanyManagementAccess;
}) {
  switch (props.moduleKey) {
    case "location-groups":
      return <LocationGroupsPanel access={props.access} createRequested={props.createModuleKey === "location-groups"} />;
    case "locations":
      return <LocationsPanel access={props.access} createRequested={props.createModuleKey === "locations"} />;
  }
}

export default function CompanyManagementWorkspace(props: {
  moduleKey: CompanyManagementModuleKey;
  createModuleKey?: CompanyManagementModuleKey | null;
  access: CompanyManagementAccess;
}) {
  return <WorkspaceCard moduleKey={props.moduleKey} createModuleKey={props.createModuleKey} access={props.access} />;
}