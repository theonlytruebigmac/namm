"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Shield,
  Users,
  Plus,
  Trash2,
  Edit2,
  Loader2,
  LogOut,
  UserCog,
} from "lucide-react";
import { useAuth, useAuthConfig, useUsers, type AuthUser } from "@/hooks/useAuth";

export function AuthSettingsCard() {
  const { user, logout, isAdmin, authenticated, authEnabled } = useAuth();
  const { config, stats, loading: configLoading, updateConfig } = useAuthConfig();
  const { users, loading: usersLoading, createUser, updateUser, deleteUser } = useUsers();

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AuthUser | null>(null);

  // New user form
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "user" | "viewer">("user");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  // Edit form
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editRole, setEditRole] = useState<"admin" | "user" | "viewer">("user");
  const [editPassword, setEditPassword] = useState("");
  const [editing, setEditing] = useState(false);

  const handleCreateUser = async () => {
    setCreating(true);
    setCreateError("");

    const result = await createUser({
      username: newUsername,
      password: newPassword,
      displayName: newDisplayName,
      role: newRole,
    });

    if (result.success) {
      setCreateDialogOpen(false);
      setNewUsername("");
      setNewPassword("");
      setNewDisplayName("");
      setNewRole("user");
    } else {
      setCreateError(result.error || "Failed to create user");
    }
    setCreating(false);
  };

  const handleEditUser = async () => {
    if (!editingUser) return;
    setEditing(true);

    const updates: { displayName?: string; role?: string; password?: string } = {};
    if (editDisplayName !== editingUser.displayName) updates.displayName = editDisplayName;
    if (editRole !== editingUser.role) updates.role = editRole;
    if (editPassword) updates.password = editPassword;

    const result = await updateUser(editingUser.id, updates);
    if (result.success) {
      setEditingUser(null);
    }
    setEditing(false);
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("Are you sure you want to delete this user?")) return;
    await deleteUser(userId);
  };

  const openEditDialog = (u: AuthUser) => {
    setEditingUser(u);
    setEditDisplayName(u.displayName);
    setEditRole(u.role);
    setEditPassword("");
  };

  if (configLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Authentication
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Authentication
          </CardTitle>
          <CardDescription>Secure access to your NAMM dashboard</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Current User Info */}
          {authenticated && user && (
            <div className="p-4 rounded-lg bg-[hsl(var(--muted))]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-[hsl(var(--primary))] flex items-center justify-center text-[hsl(var(--primary-foreground))] font-bold">
                    {user.displayName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-medium">{user.displayName}</div>
                    <div className="text-sm text-[hsl(var(--muted-foreground))]">
                      @{user.username}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                    {user.role}
                  </Badge>
                  <Button variant="ghost" size="sm" onClick={logout}>
                    <LogOut className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Auth Config */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="text-sm font-medium">Enable Authentication</div>
                <div className="text-sm text-[hsl(var(--muted-foreground))]">
                  Require login to access the dashboard
                </div>
              </div>
              <Switch
                checked={config?.enabled ?? false}
                onCheckedChange={(checked) => updateConfig({ enabled: checked })}
              />
            </div>

            {config?.enabled && (
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="text-sm font-medium">Require Auth for All Pages</div>
                  <div className="text-sm text-[hsl(var(--muted-foreground))]">
                    Block access without authentication
                  </div>
                </div>
                <Switch
                  checked={config?.requireAuth ?? false}
                  onCheckedChange={(checked) => updateConfig({ requireAuth: checked })}
                />
              </div>
            )}

            {/* Stats */}
            {stats && (
              <div className="flex gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <Users className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                  <span>{stats.totalUsers} users</span>
                </div>
                <div className="flex items-center gap-1">
                  <Shield className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                  <span>{stats.activeSessions} sessions</span>
                </div>
              </div>
            )}
          </div>

          {/* User Management (Admin Only) */}
          {isAdmin && config?.enabled && (
            <div className="pt-4 border-t border-[hsl(var(--border))]">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <UserCog className="h-4 w-4" />
                  <span className="font-medium">User Management</span>
                </div>
                <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="h-4 w-4 mr-1" />
                      Add User
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create New User</DialogTitle>
                      <DialogDescription>
                        Add a new user to access the dashboard
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      {createError && (
                        <div className="p-2 text-sm text-[hsl(var(--red))] bg-[hsl(var(--red))]/10 rounded">
                          {createError}
                        </div>
                      )}
                      <div className="space-y-2">
                        <Label>Username</Label>
                        <Input
                          value={newUsername}
                          onChange={(e) => setNewUsername(e.target.value)}
                          placeholder="username"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Display Name</Label>
                        <Input
                          value={newDisplayName}
                          onChange={(e) => setNewDisplayName(e.target.value)}
                          placeholder="John Doe"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Password</Label>
                        <Input
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="••••••••"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Role</Label>
                        <Select value={newRole} onValueChange={(v) => setNewRole(v as typeof newRole)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="viewer">Viewer</SelectItem>
                            <SelectItem value="user">User</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        onClick={handleCreateUser}
                        disabled={creating || !newUsername || !newPassword || !newDisplayName}
                        className="w-full"
                      >
                        {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Create User
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              {/* User List */}
              {usersLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : (
                <div className="space-y-2">
                  {users.map((u) => (
                    <div
                      key={u.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-[hsl(var(--muted))]"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-[hsl(var(--primary))]/20 flex items-center justify-center text-sm font-medium">
                          {u.displayName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium text-sm">{u.displayName}</div>
                          <div className="text-xs text-[hsl(var(--muted-foreground))]">
                            @{u.username}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {u.role}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(u)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        {u.id !== user?.id && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteUser(u.id)}
                          >
                            <Trash2 className="h-4 w-4 text-[hsl(var(--red))]" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit User Dialog */}
      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user details for @{editingUser?.username}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Display Name</Label>
              <Input
                value={editDisplayName}
                onChange={(e) => setEditDisplayName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={editRole} onValueChange={(v) => setEditRole(v as typeof editRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="viewer">Viewer</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>New Password (optional)</Label>
              <Input
                type="password"
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
                placeholder="Leave blank to keep current"
              />
            </div>
            <Button
              onClick={handleEditUser}
              disabled={editing}
              className="w-full"
            >
              {editing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
