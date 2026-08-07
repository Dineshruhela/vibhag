/**
 * Sheet Component
 * Bottom sheet wrapper using @gorhom/bottom-sheet
 * Replaces Alert.alert for actions and forms
 */
import { BorderRadius, Spacing } from '@/constants/Spacing';
import { FontFamily, Typography } from '@/constants/Typography';
import { useThemeColors } from '@/hooks/useThemeColor';
import BottomSheet, {
    BottomSheetBackdrop,
    BottomSheetBackdropProps,
    BottomSheetScrollView,
    BottomSheetView,
} from '@gorhom/bottom-sheet';
import React, { useCallback, useEffect, useRef } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type Props = {
  isVisible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  snapPoints?: (string | number)[];
  scrollable?: boolean;
};

export function Sheet({
  isVisible,
  onClose,
  title,
  children,
  snapPoints = ['50%'],
  scrollable = false,
}: Props) {
  const colors = useThemeColors();
  const sheetRef = useRef<BottomSheet>(null);

  useEffect(() => {
    if (isVisible) {
      sheetRef.current?.expand();
    } else {
      sheetRef.current?.close();
    }
  }, [isVisible]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
        onPress={onClose}
      />
    ),
    [onClose]
  );

  const handleSheetChange = useCallback(
    (index: number) => {
      if (index === -1) onClose();
    },
    [onClose]
  );

  const containerStyle = {
    backgroundColor: colors.surface,
    borderTopLeftRadius: BorderRadius['3xl'],
    borderTopRightRadius: BorderRadius['3xl'],
  };

  const handleStyle = {
    backgroundColor: colors.border,
    width: 40,
    height: 4,
    borderRadius: BorderRadius.full,
  };

  const ContentContainer = scrollable ? BottomSheetScrollView : BottomSheetView;

  return (
    <BottomSheet
      ref={sheetRef}
      index={isVisible ? 0 : -1}
      snapPoints={snapPoints}
      enablePanDownToClose
      onClose={onClose}
      onChange={handleSheetChange}
      backdropComponent={renderBackdrop}
      backgroundStyle={containerStyle}
      handleIndicatorStyle={handleStyle}
    >
      <ContentContainer style={styles.content}>
        {title && (
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          </View>
        )}
        {children}
      </ContentContainer>
    </BottomSheet>
  );
}

// ─── Sheet Action Item ────────────────────────────────────────────
type ActionProps = {
  label: string;
  icon?: React.ReactNode;
  onPress: () => void;
  destructive?: boolean;
};

export function SheetAction({ label, icon, onPress, destructive = false }: ActionProps) {
  const colors = useThemeColors();
  return (
    <TouchableOpacity
      style={[styles.action, { borderBottomColor: colors.borderLight }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {icon && <View style={styles.actionIcon}>{icon}</View>}
      <Text style={[styles.actionLabel, { color: destructive ? colors.error : colors.text }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing['3xl'],
  },
  header: {
    paddingVertical: Spacing.base,
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  title: {
    fontSize: Typography.size.lg,
    fontFamily: FontFamily.semibold,
    fontWeight: '600',
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.base,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.md,
  },
  actionIcon: {
    width: 24,
    alignItems: 'center',
  },
  actionLabel: {
    fontSize: Typography.size.base,
    fontFamily: FontFamily.medium,
    fontWeight: '500',
  },
});
