import { ApiEvent } from '@/app/components/EventCard';
import FlyerCard from '@/app/components/home/FlyerCard';
import { useOnboarding } from '@/app/context/OnboardingContext';
import { ApiError, api } from '@/app/lib/api';
import { events as eventsKeys, feed as feedKeys } from '@/app/lib/queryKeys';
import { useSavedEvents } from '@/app/lib/useSavedEvents';
import ArrowLeftIcon from '@/assets/images/arrow-left.svg';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeColors } from '@/app/lib/themeColors';

type EventsListResponse = { events: ApiEvent[] };
type FeedHomeSections = { sections: { key: string; events: ApiEvent[] }[] };

/**
 * Upcoming's full list from GET /feed/upcoming.
 *
 * If the server answers 404 it has not been updated with that endpoint yet — and
 * the app talks to the DEPLOYED Worker by default (app/config/api.ts), which
 * lags the repo until someone deploys. Rather than a page that claims there are
 * no events, fall back to the Upcoming row Home already gets from /feed/home:
 * the same events and order, just the row's handful instead of the full list.
 * Any other failure is a real failure and is rethrown for the error state.
 */
async function fetchUpcoming(token: string | null): Promise<EventsListResponse> {
  try {
    return await api.get<EventsListResponse>('/feed/upcoming?limit=50', { token });
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 404) throw err;
    const home = await api.get<FeedHomeSections>('/feed/home', { token });
    return { events: home.sections.find((s) => s.key === 'upcoming')?.events ?? [] };
  }
}

// Page inset and the gap between the two columns.
const GUTTER = 20;
const COLUMN_GAP = 12;

export default function ViewAllScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  // Home carousels pass `bucketId` (ranked feed). A legacy `search` param is
  // still honored for any caller building a raw /events query.
  //
  // `section=upcoming` is Home's Upcoming row, which is not a bucket and has its
  // own endpoint (GET /feed/upcoming) — the same events in the same order as the
  // row, further down the list.
  const { title, bucketId, section, search } = useLocalSearchParams<{
    title: string;
    bucketId?: string;
    section?: string;
    search?: string;
  }>();
  const upcoming = section === 'upcoming';
  const { data } = useOnboarding();
  const token = data.token || null;
  const { savedIds, toggleSave: handleToggleSave } = useSavedEvents(token);

  const eventsQuery = useQuery({
    queryKey: upcoming
      ? feedKeys.upcoming()
      : bucketId
        ? feedKeys.bucket(bucketId)
        : eventsKeys.list({ filter: `view-all-${search}` }),
    queryFn: () =>
      upcoming
        ? fetchUpcoming(token)
        : bucketId
          ? api.get<EventsListResponse>(`/feed/bucket/${bucketId}?limit=50`, { token })
          : api.get<EventsListResponse>(`/events?${search}&limit=50`, { token }),
    staleTime: 30_000,
  });

  const events = eventsQuery.data?.events ?? [];

  // Two flyer cards across, the same card Home's rows use. Sized from the screen
  // rather than flex-filled so a lone card on an odd last row stays one column
  // wide instead of stretching across the page.
  const cardWidth = Math.floor((screenWidth - GUTTER * 2 - COLUMN_GAP) / 2);

  // Back, with somewhere to go if this was opened without history (a deep link).
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/home'));

  return (
    // No bottom edge: this screen lives inside the tab navigator now, and the tab
    // bar already clears the home indicator. Adding the inset here as well would
    // leave a band of empty space between the grid and the bar.
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.background }}
      edges={['top', 'left', 'right']}
    >
      {/* Pinned: the arrow stays put while the grid scrolls under it, so the way
          out is never a long scroll back to the top (LOOP-283). The title below
          scrolls with the content. */}
      <View style={{ paddingHorizontal: GUTTER, paddingTop: 12, paddingBottom: 8 }}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={goBack}
          hitSlop={12}
          style={{ alignSelf: 'flex-start' }}
        >
          <ArrowLeftIcon width={28} height={28} color={colors.ink} />
        </TouchableOpacity>
      </View>

      {eventsQuery.isPending ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : eventsQuery.isError ? (
        // A failed request is not "no events". This used to fall through to the
        // empty message, so a server error read as an empty category.
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 }}>
          <Text style={{ fontSize: 16, color: colors.inkMuted, textAlign: 'center' }}>
            Something went wrong loading events.
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => eventsQuery.refetch()}
            style={{ marginTop: 12, padding: 8 }}
          >
            <Text style={{ fontSize: 16, color: colors.accent }}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : events.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 }}>
          <Text style={{ fontSize: 16, color: colors.inkMuted, textAlign: 'center' }}>
            {upcoming
              ? 'No upcoming events right now.'
              : 'No events found in this category right now.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={events}
          numColumns={2}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: GUTTER,
            paddingBottom: 32,
            gap: COLUMN_GAP,
          }}
          columnWrapperStyle={{ gap: COLUMN_GAP }}
          keyExtractor={(item) => `${item.source}-${item.source_event_id}`}
          ListHeaderComponent={
            <Text
              accessibilityRole="header"
              style={{
                fontFamily: 'Roboto-Flex-Bold',
                fontSize: 28,
                color: colors.ink,
                marginTop: 8,
                marginBottom: 8,
              }}
            >
              {title || 'Events'}
            </Text>
          }
          renderItem={({ item }) => (
            <FlyerCard
              item={item}
              width={cardWidth}
              isSaved={savedIds.has(item.id)}
              onToggleSave={handleToggleSave}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}
