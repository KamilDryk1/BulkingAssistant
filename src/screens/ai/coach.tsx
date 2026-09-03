import { useCalendars } from 'expo-localization';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { Card } from '@/components/card';
import { QueryStateCard } from '@/components/query-state-card';
import {
  useCancelCoachTool,
  useCoachConversation,
  useCoachConversations,
  useConfirmCoachTool,
  useSendCoachMessage,
} from '@/features/ai/coach-queries';
import type { SendCoachMessageInput } from '@/features/ai/coach-types';
import { useDailyAnalysis } from '@/features/ai/daily-analysis-queries';
import { useAuth } from '@/features/auth/auth-context';
import { useCurrentDate } from '@/features/today/use-current-date';
import { createCoachRequestId } from '@/services/ai/coach-service';
import { colors, layout, opacity, radius, spacing, typography } from '@/theme';
import type { AiMessageRow, AiToolRunRow } from '@/types/database';

function normalizeParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

function MessageBubble({ message }: { message: AiMessageRow }) {
  const isUser = message.role === 'user';

  return (
    <View style={{ alignItems: isUser ? 'flex-end' : 'flex-start', width: '100%' }}>
      <View
        style={{
          backgroundColor: isUser ? colors.primaryMuted : colors.surfaceElevated,
          borderColor: isUser ? colors.borderStrong : colors.border,
          borderCurve: 'continuous',
          borderRadius: radius.lg,
          borderWidth: layout.borderWidth,
          maxWidth: layout.chatMessageMaxWidth,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
        }}
      >
        <AppText selectable color={isUser ? 'textPrimary' : 'textSecondary'}>
          {message.content}
        </AppText>
      </View>
    </View>
  );
}

function ConfirmationCard({
  cancelling,
  confirming,
  onCancel,
  onConfirm,
  toolRun,
}: {
  cancelling: boolean;
  confirming: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  toolRun: AiToolRunRow;
}) {
  const { t } = useTranslation('ai');
  const pending = toolRun.status === 'awaiting_confirmation' || toolRun.status === 'running';

  return (
    <Card elevated style={{ gap: spacing.md, marginTop: spacing.sm }}>
      <AppText color={pending ? 'primary' : 'textMuted'} variant="label">
        {t(`coach.confirmation.status.${toolRun.status}`)}
      </AppText>
      <AppText color="textSecondary" selectable>
        {toolRun.confirmation_summary}
      </AppText>
      {pending ? (
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <AppButton
            disabled={confirming || toolRun.status === 'running'}
            loading={cancelling}
            onPress={onCancel}
            style={{ flex: 1 }}
            title={t('coach.confirmation.cancel')}
            variant="ghost"
          />
          <AppButton
            disabled={cancelling}
            loading={confirming}
            onPress={onConfirm}
            style={{ flex: 1 }}
            title={t(
              toolRun.status === 'running'
                ? 'coach.confirmation.retryApply'
                : 'coach.confirmation.apply',
            )}
          />
        </View>
      ) : null}
    </Card>
  );
}

function ConversationMessage({
  cancellingToolId,
  confirmingToolId,
  message,
  onCancel,
  onConfirm,
  toolRuns,
}: {
  cancellingToolId: string | null;
  confirmingToolId: string | null;
  message: AiMessageRow;
  onCancel: (toolRunId: string) => void;
  onConfirm: (toolRunId: string) => void;
  toolRuns: AiToolRunRow[];
}) {
  return (
    <View style={{ gap: spacing.xs }}>
      <MessageBubble message={message} />
      {toolRuns.map((toolRun) => (
        <ConfirmationCard
          cancelling={cancellingToolId === toolRun.id}
          confirming={confirmingToolId === toolRun.id}
          key={toolRun.id}
          onCancel={() => onCancel(toolRun.id)}
          onConfirm={() => onConfirm(toolRun.id)}
          toolRun={toolRun}
        />
      ))}
    </View>
  );
}

export function CoachScreen() {
  const { t } = useTranslation(['ai', 'common']);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [calendar] = useCalendars();
  const params = useLocalSearchParams<{
    analysisId?: string | string[];
    conversationId?: string | string[];
  }>();
  const initialAnalysisId = normalizeParam(params.analysisId);
  const initialConversationId = normalizeParam(params.conversationId);
  const { profile } = useAuth();
  const { dateKey } = useCurrentDate();
  const timeZone = calendar?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
  const [activeConversationId, setActiveConversationId] = useState(initialConversationId);
  const [useLatestConversation, setUseLatestConversation] = useState(
    !initialConversationId && !initialAnalysisId,
  );
  const [sourceAnalysisId, setSourceAnalysisId] = useState(initialAnalysisId);
  const [composer, setComposer] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [retryInput, setRetryInput] = useState<SendCoachMessageInput | null>(null);
  const listRef = useRef<FlatList<AiMessageRow>>(null);
  const conversations = useCoachConversations();
  const effectiveConversationId =
    activeConversationId ||
    (useLatestConversation && !sourceAnalysisId ? (conversations.data?.[0]?.id ?? '') : '');
  const conversation = useCoachConversation(effectiveConversationId);
  const sourceAnalysis = useDailyAnalysis(sourceAnalysisId);
  const send = useSendCoachMessage();
  const confirm = useConfirmCoachTool();
  const cancel = useCancelCoachTool();
  const resolvingTool = confirm.isPending || cancel.isPending;

  useEffect(() => {
    if ((conversation.data?.messages.length ?? 0) > 0 || pendingMessage) {
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    }
  }, [conversation.data?.messages.length, pendingMessage]);

  const toolRunsByMessage = useMemo(() => {
    const result = new Map<string, AiToolRunRow[]>();
    (conversation.data?.toolRuns ?? [])
      .filter((toolRun) => toolRun.tool_kind === 'persistent_write' && toolRun.assistant_message_id)
      .forEach((toolRun) => {
        const current = result.get(toolRun.assistant_message_id!) ?? [];
        current.push(toolRun);
        result.set(toolRun.assistant_message_id!, current);
      });
    return result;
  }, [conversation.data?.toolRuns]);

  const newConversation = () => {
    setActiveConversationId('');
    setUseLatestConversation(false);
    setSourceAnalysisId('');
    setComposer('');
    setPendingMessage(null);
    setRetryInput(null);
    setShowHistory(false);
  };

  const submitInput = (input: NonNullable<typeof retryInput>) => {
    setPendingMessage(input.message);
    setRetryInput(input);
    send.mutate(input, {
      onSuccess: (response) => {
        setActiveConversationId(response.conversation.id);
        setUseLatestConversation(false);
        setSourceAnalysisId('');
        setPendingMessage(null);
        setRetryInput(null);
      },
    });
  };

  const submit = () => {
    const message = composer.trim();
    if (!message || send.isPending || resolvingTool) {
      return;
    }

    setComposer('');
    submitInput({
      analysisId: sourceAnalysisId || undefined,
      clientRequestId: createCoachRequestId(),
      conversationId: effectiveConversationId || undefined,
      localDate: dateKey,
      message,
      timeZone,
    });
  };

  const resolveTool = (toolRunId: string, action: 'confirm' | 'cancel') => {
    const mutation = action === 'confirm' ? confirm : cancel;
    mutation.mutate({ localDate: dateKey, timeZone, toolRunId });
  };

  const messages = conversation.data?.messages ?? [];
  const loadingConversation = Boolean(
    (useLatestConversation && !sourceAnalysisId && conversations.isPending) ||
    (effectiveConversationId && conversation.isPending),
  );
  const failedConversation = Boolean(
    (useLatestConversation && !sourceAnalysisId && conversations.isError) ||
    (effectiveConversationId && conversation.isError),
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ backgroundColor: colors.background, flex: 1 }}
    >
      <View
        style={{
          alignItems: 'center',
          borderBottomColor: colors.border,
          borderBottomWidth: layout.borderWidth,
          flexDirection: 'row',
          gap: spacing.md,
          paddingBottom: spacing.md,
          paddingHorizontal: layout.screenPadding,
          paddingTop: insets.top + spacing.sm,
        }}
      >
        <Pressable
          accessibilityLabel={t('coach.back')}
          accessibilityRole="button"
          hitSlop={spacing.md}
          onPress={() => router.back()}
          style={({ pressed }) => ({
            opacity: pressed ? opacity.pressed : 1,
            padding: spacing.sm,
          })}
        >
          <AppText color="primary" variant="title">
            ‹
          </AppText>
        </Pressable>
        <View style={{ flex: 1 }}>
          <AppText variant="title">{t('coach.title')}</AppText>
          <AppText color="textMuted" variant="caption">
            {t('coach.subtitle')}
          </AppText>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => setShowHistory((value) => !value)}
          style={({ pressed }) => ({
            opacity: pressed ? opacity.pressed : 1,
            padding: spacing.sm,
          })}
        >
          <AppText color="textSecondary" variant="label">
            {t('coach.history')}
          </AppText>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={newConversation}
          style={({ pressed }) => ({
            opacity: pressed ? opacity.pressed : 1,
            padding: spacing.sm,
          })}
        >
          <AppText color="primary" variant="label">
            {t('coach.new')}
          </AppText>
        </Pressable>
      </View>

      {showHistory ? (
        <FlatList
          contentContainerStyle={{ gap: spacing.sm, padding: layout.screenPadding }}
          data={conversations.data ?? []}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            conversations.isPending ? (
              <QueryStateCard
                detail={t('coach.loadingHistoryDetail')}
                title={t('coach.loadingHistory')}
              />
            ) : conversations.isError ? (
              <QueryStateCard
                actionLabel={t('coach.retry')}
                detail={t('coach.loadErrorDetail')}
                onAction={() => void conversations.refetch()}
                title={t('coach.loadError')}
              />
            ) : (
              <QueryStateCard detail={t('coach.noHistoryDetail')} title={t('coach.noHistory')} />
            )
          }
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setActiveConversationId(item.id);
                setUseLatestConversation(false);
                setSourceAnalysisId('');
                setShowHistory(false);
              }}
            >
              <Card elevated={item.id === effectiveConversationId} style={{ gap: spacing.xs }}>
                <AppText numberOfLines={1} variant="bodyStrong">
                  {item.title ?? t('coach.untitled')}
                </AppText>
                <AppText color="textMuted" variant="caption">
                  {new Intl.DateTimeFormat(profile?.locale ?? 'en', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  }).format(new Date(item.updated_at))}
                </AppText>
              </Card>
            </Pressable>
          )}
        />
      ) : loadingConversation ? (
        <View style={{ padding: layout.screenPadding }}>
          <QueryStateCard detail={t('coach.loadingDetail')} title={t('coach.loading')} />
        </View>
      ) : failedConversation ? (
        <View style={{ padding: layout.screenPadding }}>
          <QueryStateCard
            actionLabel={t('coach.retry')}
            detail={t('coach.loadErrorDetail')}
            onAction={() => {
              void conversations.refetch();
              void conversation.refetch();
            }}
            title={t('coach.loadError')}
          />
        </View>
      ) : (
        <>
          <FlatList
            ref={listRef}
            automaticallyAdjustKeyboardInsets
            contentContainerStyle={{
              flexGrow: 1,
              gap: spacing.lg,
              padding: layout.screenPadding,
            }}
            data={messages}
            keyExtractor={(item) => item.id}
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <View style={{ flex: 1, gap: spacing.xl, justifyContent: 'center' }}>
                {sourceAnalysis.data?.status === 'suggestion' ? (
                  <Card elevated style={{ gap: spacing.sm }}>
                    <AppText color="primary" variant="label">
                      {t('coach.analysisContext')}
                    </AppText>
                    <AppText variant="title">{sourceAnalysis.data.title}</AppText>
                    <AppText color="textSecondary">{sourceAnalysis.data.message}</AppText>
                  </Card>
                ) : null}
                <View style={{ gap: spacing.sm }}>
                  <AppText variant="heading">{t('coach.emptyTitle')}</AppText>
                  <AppText color="textSecondary">{t('coach.emptyDetail')}</AppText>
                </View>
                <View style={{ gap: spacing.sm }}>
                  {(['progress', 'workout', 'weight'] as const).map((key) => {
                    const prompt = t(`coach.prompts.${key}`);
                    return (
                      <Pressable
                        accessibilityRole="button"
                        key={key}
                        onPress={() => setComposer(prompt)}
                      >
                        <Card style={{ paddingVertical: spacing.md }}>
                          <AppText color="textSecondary">“{prompt}”</AppText>
                        </Card>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            }
            ListFooterComponent={
              pendingMessage ? (
                <View style={{ gap: spacing.md }}>
                  <MessageBubble
                    message={{
                      client_request_id: null,
                      content: pendingMessage,
                      conversation_id: effectiveConversationId,
                      created_at: new Date().toISOString(),
                      id: 'pending-user-message',
                      provider_response_id: null,
                      role: 'user',
                      user_id: '',
                    }}
                  />
                  <View style={{ alignItems: 'flex-start' }}>
                    <Card style={{ gap: spacing.sm }}>
                      <AppText color="primary" variant="label">
                        {send.isError ? t('coach.responseError') : t('coach.working')}
                      </AppText>
                      <AppText color="textSecondary">
                        {send.isError ? t('coach.responseErrorDetail') : t('coach.workingDetail')}
                      </AppText>
                      {send.isError && retryInput ? (
                        <AppButton
                          onPress={() => submitInput(retryInput)}
                          title={t('coach.retry')}
                          variant="secondary"
                        />
                      ) : null}
                    </Card>
                  </View>
                </View>
              ) : null
            }
            renderItem={({ item }) => (
              <ConversationMessage
                cancellingToolId={cancel.isPending ? cancel.variables.toolRunId : null}
                confirmingToolId={confirm.isPending ? confirm.variables.toolRunId : null}
                message={item}
                onCancel={(toolRunId) => resolveTool(toolRunId, 'cancel')}
                onConfirm={(toolRunId) => resolveTool(toolRunId, 'confirm')}
                toolRuns={toolRunsByMessage.get(item.id) ?? []}
              />
            )}
            showsVerticalScrollIndicator={false}
          />

          {confirm.isError || cancel.isError ? (
            <AppText
              color="danger"
              style={{ paddingHorizontal: layout.screenPadding }}
              variant="caption"
            >
              {t('coach.confirmation.error')}
            </AppText>
          ) : null}

          <View
            style={{
              backgroundColor: colors.surface,
              borderTopColor: colors.border,
              borderTopWidth: layout.borderWidth,
              flexDirection: 'row',
              gap: spacing.sm,
              paddingBottom: insets.bottom + spacing.sm,
              paddingHorizontal: layout.screenPadding,
              paddingTop: spacing.sm,
            }}
          >
            <TextInput
              accessibilityLabel={t('coach.inputLabel')}
              editable={!send.isPending && !resolvingTool}
              maxLength={2000}
              multiline
              onChangeText={setComposer}
              onSubmitEditing={submit}
              placeholder={t('coach.inputPlaceholder')}
              placeholderTextColor={colors.textMuted}
              returnKeyType="send"
              style={[
                typography.body,
                {
                  backgroundColor: colors.surfaceElevated,
                  borderColor: colors.borderStrong,
                  borderRadius: radius.md,
                  borderWidth: layout.borderWidth,
                  color: colors.textPrimary,
                  flex: 1,
                  maxHeight: layout.chatComposerMaxHeight,
                  minHeight: layout.buttonHeight,
                  paddingHorizontal: spacing.lg,
                  paddingVertical: spacing.md,
                  textAlignVertical: 'top',
                },
              ]}
              value={composer}
            />
            <AppButton
              disabled={!composer.trim() || send.isPending || resolvingTool}
              loading={send.isPending}
              onPress={submit}
              style={{ alignSelf: 'flex-end' }}
              title={t('coach.send')}
            />
          </View>
        </>
      )}
    </KeyboardAvoidingView>
  );
}
